import SwiftUI
import SwiftData
import Charts

struct DiaryView: View {
    @Environment(\.modelContext) private var context
    @Query private var profiles: [UserProfile]
    @Query(sort: \MealEntry.date) private var allEntries: [MealEntry]

    @State private var selectedDate: Date = .now
    @State private var showingAddSheet = false

    private var entriesForDay: [MealEntry] {
        allEntries.filter { DateHelpers.isSameDay($0.date, selectedDate) }
    }

    private var totals: MacroTotals {
        MacroCalculator.totals(for: entriesForDay)
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    DatePicker("Día", selection: $selectedDate, displayedComponents: .date)
                }

                if let profile = profiles.first {
                    Section("Última semana") {
                        WeeklyCaloriesChart(
                            entries: allEntries,
                            endDate: selectedDate,
                            calorieGoal: profile.calorieGoal
                        )
                    }

                    Section("Resumen del día") {
                        MacroProgressRow(label: "Calorías", value: Double(totals.calories),
                                         goal: Double(profile.calorieGoal), unit: "kcal", color: .orange)
                        MacroProgressRow(label: "Proteínas", value: totals.protein,
                                         goal: Double(profile.proteinGoal), unit: "g", color: .red)
                        MacroProgressRow(label: "Carbos", value: totals.carbs,
                                         goal: Double(profile.carbsGoal), unit: "g", color: .blue)
                        MacroProgressRow(label: "Grasas", value: totals.fat,
                                         goal: Double(profile.fatGoal), unit: "g", color: .yellow)
                    }
                }

                ForEach(MealType.allCases) { mealType in
                    let meals = entriesForDay.filter { $0.mealType == mealType }
                    if !meals.isEmpty {
                        Section {
                            ForEach(meals) { entry in
                                MealEntryRow(entry: entry)
                            }
                            .onDelete { offsets in
                                for index in offsets {
                                    context.delete(meals[index])
                                }
                            }
                        } header: {
                            Label(mealType.rawValue, systemImage: mealType.icon)
                        }
                    }
                }

                if entriesForDay.isEmpty {
                    ContentUnavailableView(
                        "Nada registrado",
                        systemImage: "fork.knife",
                        description: Text("Añade lo que has comido con el botón +.")
                    )
                }
            }
            .navigationTitle("Diario")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingAddSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingAddSheet) {
                AddMealEntryView(date: selectedDate)
            }
        }
    }
}

/// Barras de calorías de los últimos 7 días (terminando en el día seleccionado),
/// con una línea de referencia en el objetivo diario.
struct WeeklyCaloriesChart: View {
    let entries: [MealEntry]
    let endDate: Date
    let calorieGoal: Int

    private struct DayCalories: Identifiable {
        let date: Date
        let calories: Int
        var id: Date { date }
    }

    private var weekData: [DayCalories] {
        let calendar = Calendar.current
        let end = calendar.startOfDay(for: endDate)
        return (0..<7).reversed().compactMap { offset in
            guard let day = calendar.date(byAdding: .day, value: -offset, to: end) else { return nil }
            let dayEntries = entries.filter { DateHelpers.isSameDay($0.date, day) }
            return DayCalories(date: day, calories: MacroCalculator.totals(for: dayEntries).calories)
        }
    }

    var body: some View {
        Chart {
            ForEach(weekData) { day in
                BarMark(
                    x: .value("Día", day.date, unit: .day),
                    y: .value("Calorías", day.calories)
                )
                .foregroundStyle(
                    DateHelpers.isSameDay(day.date, endDate) ? Color.accentColor : Color.accentColor.opacity(0.4)
                )
                .cornerRadius(4)
            }

            RuleMark(y: .value("Objetivo", calorieGoal))
                .foregroundStyle(.orange)
                .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                .annotation(position: .top, alignment: .trailing) {
                    Text("Objetivo: \(calorieGoal) kcal")
                        .font(.caption2)
                        .foregroundStyle(.orange)
                }
        }
        .chartXAxis {
            AxisMarks(values: .stride(by: .day)) { _ in
                AxisValueLabel(format: .dateTime.weekday(.narrow), centered: true)
            }
        }
        .frame(height: 160)
        .padding(.vertical, 4)
    }
}

struct MacroProgressRow: View {
    let label: String
    let value: Double
    let goal: Double
    let unit: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label)
                Spacer()
                Text("\(Int(value)) / \(Int(goal)) \(unit)")
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
            .font(.subheadline)
            ProgressView(value: MacroCalculator.progress(value, goal: goal))
                .tint(color)
        }
        .padding(.vertical, 2)
    }
}

struct MealEntryRow: View {
    let entry: MealEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(entry.customName ?? "Receta")
            Text("\(entry.calories) kcal · P \(Int(entry.protein))g · C \(Int(entry.carbs))g · G \(Int(entry.fat))g")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}

#Preview {
    DiaryView()
        .modelContainer(for: [UserProfile.self, MealEntry.self, Recipe.self], inMemory: true)
}
