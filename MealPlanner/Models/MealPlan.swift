import Foundation
import SwiftData

@Model
final class MealPlan {
    @Attribute(.unique) var weekStartDate: Date   // siempre el lunes de esa semana
    var monday: DayPlan
    var tuesday: DayPlan
    var wednesday: DayPlan
    var thursday: DayPlan
    var friday: DayPlan
    var saturday: DayPlan
    var sunday: DayPlan

    init(weekStartDate: Date) {
        self.weekStartDate = weekStartDate
        self.monday = DayPlan()
        self.tuesday = DayPlan()
        self.wednesday = DayPlan()
        self.thursday = DayPlan()
        self.friday = DayPlan()
        self.saturday = DayPlan()
        self.sunday = DayPlan()
    }

    /// Acceso por índice de día (0 = lunes ... 6 = domingo) para iterar en la UI.
    func dayPlan(at index: Int) -> DayPlan {
        switch index {
        case 0: return monday
        case 1: return tuesday
        case 2: return wednesday
        case 3: return thursday
        case 4: return friday
        case 5: return saturday
        default: return sunday
        }
    }

    func setDayPlan(_ plan: DayPlan, at index: Int) {
        switch index {
        case 0: monday = plan
        case 1: tuesday = plan
        case 2: wednesday = plan
        case 3: thursday = plan
        case 4: friday = plan
        case 5: saturday = plan
        default: sunday = plan
        }
    }
}

struct DayPlan: Codable {
    var breakfast: String?         // Recipe ID
    var lunch: String?
    var dinner: String?
    var snack: String?

    func recipeId(for meal: MealType) -> String? {
        switch meal {
        case .breakfast: return breakfast
        case .lunch: return lunch
        case .dinner: return dinner
        case .snack: return snack
        }
    }

    mutating func setRecipeId(_ id: String?, for meal: MealType) {
        switch meal {
        case .breakfast: breakfast = id
        case .lunch: lunch = id
        case .dinner: dinner = id
        case .snack: snack = id
        }
    }
}
