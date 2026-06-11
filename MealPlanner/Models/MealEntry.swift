import Foundation
import SwiftData

@Model
final class MealEntry {
    var date: Date
    var mealType: MealType         // .breakfast, .lunch, .dinner, .snack
    var recipeId: String?          // si fue una receta guardada
    var customName: String?        // si fue algo ad hoc
    var calories: Int
    var protein: Double
    var carbs: Double
    var fat: Double

    init(
        date: Date = .now,
        mealType: MealType,
        recipeId: String? = nil,
        customName: String? = nil,
        calories: Int,
        protein: Double,
        carbs: Double,
        fat: Double
    ) {
        self.date = date
        self.mealType = mealType
        self.recipeId = recipeId
        self.customName = customName
        self.calories = calories
        self.protein = protein
        self.carbs = carbs
        self.fat = fat
    }
}

enum MealType: String, Codable, CaseIterable, Identifiable {
    case breakfast = "Desayuno"
    case lunch = "Comida"
    case dinner = "Cena"
    case snack = "Snack"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .breakfast: return "cup.and.saucer"
        case .lunch: return "fork.knife"
        case .dinner: return "moon.stars"
        case .snack: return "carrot"
        }
    }
}
