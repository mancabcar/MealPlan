import Foundation
import SwiftData

@Model
final class PantryItem {
    var name: String
    var quantity: String           // "200g", "1 bote", "3 unidades"
    var expiryDate: Date?
    var category: PantryCategory   // .fridge, .pantry, .freezer
    var createdAt: Date

    /// Caduca en menos de 3 días (y aún no ha pasado más de un día desde la caducidad).
    var isExpiringSoon: Bool {
        guard let expiryDate else { return false }
        let days = Calendar.current.dateComponents(
            [.day],
            from: Calendar.current.startOfDay(for: .now),
            to: Calendar.current.startOfDay(for: expiryDate)
        ).day ?? 0
        return days >= 0 && days < 3
    }

    var isExpired: Bool {
        guard let expiryDate else { return false }
        return Calendar.current.startOfDay(for: expiryDate) < Calendar.current.startOfDay(for: .now)
    }

    init(
        name: String,
        quantity: String,
        expiryDate: Date? = nil,
        category: PantryCategory = .fridge,
        createdAt: Date = .now
    ) {
        self.name = name
        self.quantity = quantity
        self.expiryDate = expiryDate
        self.category = category
        self.createdAt = createdAt
    }
}

enum PantryCategory: String, Codable, CaseIterable, Identifiable {
    case fridge = "Nevera"
    case pantry = "Despensa"
    case freezer = "Congelador"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .fridge: return "refrigerator"
        case .pantry: return "cabinet"
        case .freezer: return "snowflake"
        }
    }
}
