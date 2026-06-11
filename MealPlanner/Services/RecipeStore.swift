import Foundation
import SwiftData

/// Carga las recetas base de Resources/recipes.json y las vuelca en SwiftData.
/// Se ejecuta en cada arranque, pero solo inserta las recetas cuyo id no exista
/// todavía, de modo que ampliar el JSON añade las nuevas sin duplicar las viejas.
enum RecipeStore {

    static func seedIfNeeded(context: ModelContext) {
        guard let recipes = loadLocalRecipes() else { return }

        let descriptor = FetchDescriptor<Recipe>(
            predicate: #Predicate { !$0.isAIGenerated }
        )
        let existingIds = Set((try? context.fetch(descriptor))?.map(\.id) ?? [])

        let missing = recipes.filter { !existingIds.contains($0.id) }
        guard !missing.isEmpty else { return }

        for dto in missing {
            context.insert(dto.toModel())
        }
        try? context.save()
    }

    static func loadLocalRecipes() -> [RecipeDTO]? {
        guard let url = Bundle.main.url(forResource: "recipes", withExtension: "json"),
              let data = try? Data(contentsOf: url) else {
            assertionFailure("recipes.json no encontrado en el bundle")
            return nil
        }
        do {
            return try JSONDecoder().decode(RecipeFile.self, from: data).recipes
        } catch {
            assertionFailure("recipes.json mal formado: \(error)")
            return nil
        }
    }
}

// MARK: - DTOs del JSON

struct RecipeFile: Codable {
    let recipes: [RecipeDTO]
}

struct RecipeDTO: Codable {
    let id: String
    let name: String
    let ingredients: [String]
    let instructions: [String]
    let prepTimeMinutes: Int
    let calories: Int
    let protein: Double
    let carbs: Double
    let fat: Double
    let tags: [String]
    var isAIGenerated: Bool? = nil

    func toModel() -> Recipe {
        Recipe(
            id: id,
            name: name,
            ingredients: ingredients,
            instructions: instructions,
            prepTimeMinutes: prepTimeMinutes,
            calories: calories,
            protein: protein,
            carbs: carbs,
            fat: fat,
            tags: tags,
            isAIGenerated: isAIGenerated ?? false
        )
    }
}
