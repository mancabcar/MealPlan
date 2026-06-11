import Foundation

/// Cliente de la API de Claude para generar recetas personalizadas.
///
/// ⚠️ La API key NO va en el código. Se lee de Resources/Secrets.plist
/// (clave "ClaudeAPIKey"), que está excluido de Git. En producción,
/// migrar a Keychain (Fase 6 del roadmap).
final class ClaudeService {

    private let apiURL = URL(string: "https://api.anthropic.com/v1/messages")!
    private let model = "claude-sonnet-4-20250514"

    private var apiKey: String? {
        guard let url = Bundle.main.url(forResource: "Secrets", withExtension: "plist"),
              let data = try? Data(contentsOf: url),
              let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any]
        else { return nil }
        return plist["ClaudeAPIKey"] as? String
    }

    // MARK: - Generar recetas personalizadas

    func generateRecipes(
        profile: UserProfile,
        pantryItems: [PantryItem],
        count: Int = 3
    ) async throws -> [RecipeDTO] {

        let expiringItems = pantryItems
            .filter { $0.isExpiringSoon }
            .map { $0.name }

        let allItems = pantryItems.map { "\($0.quantity) de \($0.name)" }

        let prompt = """
        Eres un nutricionista y chef personal. Genera \(count) recetas personalizadas.

        PERFIL DEL USUARIO:
        - Calorías objetivo: \(profile.calorieGoal) kcal/día
        - Proteínas: \(profile.proteinGoal)g | Carbos: \(profile.carbsGoal)g | Grasas: \(profile.fatGoal)g
        - Restricciones: \(profile.dietaryRestrictions.isEmpty ? "Ninguna" : profile.dietaryRestrictions.joined(separator: ", "))
        - No le gusta: \(profile.dislikedIngredients.isEmpty ? "Nada en particular" : profile.dislikedIngredients.joined(separator: ", "))

        INGREDIENTES DISPONIBLES:
        \(allItems.isEmpty ? "Sin información de despensa" : allItems.joined(separator: "\n"))

        INGREDIENTES QUE URGE USAR (caducan pronto):
        \(expiringItems.isEmpty ? "Ninguno" : expiringItems.joined(separator: ", "))

        INSTRUCCIONES:
        - Prioriza usar los ingredientes que caducan pronto
        - Cada receta debe ser para 1 persona
        - Incluye macros exactos
        - Respeta siempre las restricciones dietéticas y evita los ingredientes que no le gustan

        Responde ÚNICAMENTE con un array JSON válido, sin texto adicional ni backticks:
        [
          {
            "id": "ai_001",
            "name": "Nombre de la receta",
            "ingredients": ["ingrediente 1", "ingrediente 2"],
            "instructions": ["paso 1", "paso 2"],
            "prepTimeMinutes": 20,
            "calories": 450,
            "protein": 35,
            "carbs": 40,
            "fat": 12,
            "tags": ["alto proteína"],
            "isAIGenerated": true
          }
        ]
        """

        let text = try await sendMessage(prompt: prompt, maxTokens: 2000)
        var recipes = try decodeJSONArray(from: text)

        // Asegura IDs únicos para no chocar con recetas generadas antes
        let suffix = UUID().uuidString.prefix(8)
        for i in recipes.indices {
            recipes[i] = RecipeDTO(
                id: "ai_\(suffix)_\(i)",
                name: recipes[i].name,
                ingredients: recipes[i].ingredients,
                instructions: recipes[i].instructions,
                prepTimeMinutes: recipes[i].prepTimeMinutes,
                calories: recipes[i].calories,
                protein: recipes[i].protein,
                carbs: recipes[i].carbs,
                fat: recipes[i].fat,
                tags: recipes[i].tags,
                isAIGenerated: true
            )
        }
        return recipes
    }

    // MARK: - Llamada genérica a la API

    private func sendMessage(prompt: String, maxTokens: Int) async throws -> String {
        guard let apiKey, !apiKey.isEmpty else {
            throw ClaudeError.missingAPIKey
        }

        let requestBody: [String: Any] = [
            "model": model,
            "max_tokens": maxTokens,
            "messages": [
                ["role": "user", "content": prompt]
            ]
        ]

        var request = URLRequest(url: apiURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)

        let (data, response) = try await URLSession.shared.data(for: request)

        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw ClaudeError.httpError(statusCode: http.statusCode)
        }

        let decoded = try JSONDecoder().decode(ClaudeResponse.self, from: data)
        guard let text = decoded.content.first(where: { $0.type == "text" })?.text else {
            throw ClaudeError.emptyResponse
        }
        return text
    }

    /// Extrae y decodifica el array JSON de la respuesta, tolerando
    /// texto extra o backticks que el modelo pueda añadir.
    private func decodeJSONArray(from text: String) throws -> [RecipeDTO] {
        guard let start = text.firstIndex(of: "["),
              let end = text.lastIndex(of: "]") else {
            throw ClaudeError.invalidJSON
        }
        let jsonData = Data(text[start...end].utf8)
        do {
            return try JSONDecoder().decode([RecipeDTO].self, from: jsonData)
        } catch {
            throw ClaudeError.invalidJSON
        }
    }
}

// MARK: - Modelos de respuesta de la API

struct ClaudeResponse: Codable {
    let content: [ContentBlock]
}

struct ContentBlock: Codable {
    let type: String
    let text: String?
}

enum ClaudeError: LocalizedError {
    case missingAPIKey
    case emptyResponse
    case invalidJSON
    case httpError(statusCode: Int)

    var errorDescription: String? {
        switch self {
        case .missingAPIKey:
            return "Falta la API key de Claude. Añádela en Resources/Secrets.plist."
        case .emptyResponse:
            return "Claude devolvió una respuesta vacía."
        case .invalidJSON:
            return "No se pudo interpretar la respuesta de Claude."
        case .httpError(let code):
            return "Error de la API de Claude (HTTP \(code))."
        }
    }
}
