import Foundation
import SwiftData

@Model
final class Recipe {
    @Attribute(.unique) var id: String
    var name: String
    var ingredients: [String]      // ["200g pechuga de pollo", "1 cebolla", ...]
    var instructions: [String]     // pasos numerados
    var prepTimeMinutes: Int
    var calories: Int
    var protein: Double
    var carbs: Double
    var fat: Double
    var tags: [String]             // ["alto proteína", "sin gluten", "rápido", ...]
    var isAIGenerated: Bool
    var createdAt: Date

    init(
        id: String,
        name: String,
        ingredients: [String],
        instructions: [String],
        prepTimeMinutes: Int,
        calories: Int,
        protein: Double,
        carbs: Double,
        fat: Double,
        tags: [String] = [],
        isAIGenerated: Bool = false,
        createdAt: Date = .now
    ) {
        self.id = id
        self.name = name
        self.ingredients = ingredients
        self.instructions = instructions
        self.prepTimeMinutes = prepTimeMinutes
        self.calories = calories
        self.protein = protein
        self.carbs = carbs
        self.fat = fat
        self.tags = tags
        self.isAIGenerated = isAIGenerated
        self.createdAt = createdAt
    }
}
