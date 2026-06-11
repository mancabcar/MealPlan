import Foundation

struct MacroTotals {
    var calories: Int = 0
    var protein: Double = 0
    var carbs: Double = 0
    var fat: Double = 0
}

enum MacroCalculator {

    static func totals(for entries: [MealEntry]) -> MacroTotals {
        entries.reduce(into: MacroTotals()) { totals, entry in
            totals.calories += entry.calories
            totals.protein += entry.protein
            totals.carbs += entry.carbs
            totals.fat += entry.fat
        }
    }

    static func totals(for recipes: [Recipe]) -> MacroTotals {
        recipes.reduce(into: MacroTotals()) { totals, recipe in
            totals.calories += recipe.calories
            totals.protein += recipe.protein
            totals.carbs += recipe.carbs
            totals.fat += recipe.fat
        }
    }

    /// Progreso 0...1 respecto a un objetivo, acotado para las barras de la UI.
    static func progress(_ value: Double, goal: Double) -> Double {
        guard goal > 0 else { return 0 }
        return min(value / goal, 1.0)
    }
}
