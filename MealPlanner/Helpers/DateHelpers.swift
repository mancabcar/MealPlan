import Foundation

enum DateHelpers {

    /// Lunes de la semana a la que pertenece la fecha dada.
    static func startOfWeek(for date: Date = .now) -> Date {
        var calendar = Calendar.current
        calendar.firstWeekday = 2  // lunes
        let components = calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)
        return calendar.startOfDay(for: calendar.date(from: components) ?? date)
    }

    static func weekDays(startingAt monday: Date) -> [Date] {
        (0..<7).compactMap { Calendar.current.date(byAdding: .day, value: $0, to: monday) }
    }

    static let weekdayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

    static func shortDay(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "es_ES")
        formatter.dateFormat = "d MMM"
        return formatter.string(from: date)
    }

    static func isSameDay(_ a: Date, _ b: Date) -> Bool {
        Calendar.current.isDate(a, inSameDayAs: b)
    }
}
