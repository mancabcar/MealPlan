import Foundation
import SwiftData

@Model
final class UserProfile {
    var name: String
    var calorieGoal: Int           // ej. 2000
    var proteinGoal: Int           // gramos
    var carbsGoal: Int
    var fatGoal: Int
    var dietaryRestrictions: [String]  // ["vegetariano", "sin gluten", ...]
    var dislikedIngredients: [String]  // ["jamón", "judías verdes", ...]
    var mealsPerDay: Int           // 3 o 4
    var createdAt: Date

    init(
        name: String = "",
        calorieGoal: Int = 2000,
        proteinGoal: Int = 120,
        carbsGoal: Int = 200,
        fatGoal: Int = 65,
        dietaryRestrictions: [String] = [],
        dislikedIngredients: [String] = [],
        mealsPerDay: Int = 3,
        createdAt: Date = .now
    ) {
        self.name = name
        self.calorieGoal = calorieGoal
        self.proteinGoal = proteinGoal
        self.carbsGoal = carbsGoal
        self.fatGoal = fatGoal
        self.dietaryRestrictions = dietaryRestrictions
        self.dislikedIngredients = dislikedIngredients
        self.mealsPerDay = mealsPerDay
        self.createdAt = createdAt
    }
}
