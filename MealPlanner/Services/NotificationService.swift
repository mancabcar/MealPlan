import Foundation
import UserNotifications

final class NotificationService {

    static let shared = NotificationService()
    private init() {}

    func requestPermission() async -> Bool {
        let center = UNUserNotificationCenter.current()
        return (try? await center.requestAuthorization(options: [.alert, .badge, .sound])) ?? false
    }

    /// Programa un aviso 2 días antes de que caduque el item.
    func scheduleExpiryNotification(for item: PantryItem) {
        guard let expiryDate = item.expiryDate,
              let notificationDate = Calendar.current.date(byAdding: .day, value: -2, to: expiryDate),
              notificationDate > .now else { return }

        let content = UNMutableNotificationContent()
        content.title = "⏰ Caduca pronto"
        content.body = "\(item.name) caduca en 2 días. ¿Quieres ver recetas para usarlo?"
        content.sound = .default

        var components = Calendar.current.dateComponents([.year, .month, .day], from: notificationDate)
        components.hour = 10   // avisar a las 10:00

        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        let request = UNNotificationRequest(
            identifier: notificationIdentifier(for: item),
            content: content,
            trigger: trigger
        )
        UNUserNotificationCenter.current().add(request)
    }

    func cancelExpiryNotification(for item: PantryItem) {
        UNUserNotificationCenter.current()
            .removePendingNotificationRequests(withIdentifiers: [notificationIdentifier(for: item)])
    }

    private func notificationIdentifier(for item: PantryItem) -> String {
        "expiry_\(item.persistentModelID.hashValue)"
    }
}
