import SwiftUI
import SwiftData

struct WeeklyPlanView: View {
    @Environment(\.modelContext) private var context
    @Query private var plans: [MealPlan]
    @Query(sort: \Recipe.name) private var recipes: [Recipe]

    @State private var weekStart = DateHelpers.startOfWeek()
    @State private var slotToAssign: SlotSelection?

    struct SlotSelection: Identifiable {
        let dayIndex: Int
        let mealType: MealType
        var id: String { "\(dayIndex)_\(mealType.rawValue)" }
    }

    private var currentPlan: MealPlan? {
        plans.first { DateHelpers.isSameDay($0.weekStartDate, weekStart) }
    }

    var body: some View {
        NavigationStack {
            List {
                weekNavigator

                ForEach(0..<7, id: \.self) { dayIndex in
                    daySection(dayIndex)
                }
            }
            .navigationTitle("Plan semanal")
            .sheet(item: $slotToAssign) { slot in
                RecipePickerView(recipes: recipes) { recipeId in
                    assign(recipeId, to: slot)
                }
            }
        }
    }

    private var weekNavigator: some View {
        HStack {
            Button {
                moveWeek(by: -1)
            } label: {
                Image(systemName: "chevron.left")
            }
            Spacer()
            Text("Semana del \(DateHelpers.shortDay(weekStart))")
                .font(.headline)
            Spacer()
            Button {
                moveWeek(by: 1)
            } label: {
                Image(systemName: "chevron.right")
            }
        }
        .buttonStyle(.borderless)
    }

    @ViewBuilder
    private func daySection(_ dayIndex: Int) -> some View {
        let dayDate = DateHelpers.weekDays(startingAt: weekStart)[dayIndex]
        let dayPlan = currentPlan?.dayPlan(at: dayIndex) ?? DayPlan()
        let dayRecipes = MealType.allCases.compactMap { meal in
            dayPlan.recipeId(for: meal).flatMap { id in recipes.first { $0.id == id } }
        }
        let totals = MacroCalculator.totals(for: dayRecipes)

        Section {
            ForEach(MealType.allCases) { mealType in
                slotRow(dayIndex: dayIndex, mealType: mealType, dayPlan: dayPlan)
            }
        } header: {
            HStack {
                Text("\(DateHelpers.weekdayNames[dayIndex]) \(DateHelpers.shortDay(dayDate))")
                Spacer()
                if totals.calories > 0 {
                    Text("\(totals.calories) kcal · P \(Int(totals.protein))g")
                        .font(.caption)
                }
            }
        }
    }

    @ViewBuilder
    private func slotRow(dayIndex: Int, mealType: MealType, dayPlan: DayPlan) -> some View {
        let recipe = dayPlan.recipeId(for: mealType).flatMap { id in recipes.first { $0.id == id } }

        Button {
            slotToAssign = SlotSelection(dayIndex: dayIndex, mealType: mealType)
        } label: {
            HStack {
                Label(mealType.rawValue, systemImage: mealType.icon)
                    .foregroundStyle(.secondary)
                    .font(.subheadline)
                Spacer()
                if let recipe {
                    Text(recipe.name)
                        .lineLimit(1)
                        .foregroundStyle(.primary)
                } else {
                    Text("Añadir")
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .swipeActions {
            if recipe != nil {
                Button("Quitar", role: .destructive) {
                    assign(nil, to: SlotSelection(dayIndex: dayIndex, mealType: mealType))
                }
            }
        }
    }

    private func moveWeek(by offset: Int) {
        if let newStart = Calendar.current.date(byAdding: .weekOfYear, value: offset, to: weekStart) {
            weekStart = DateHelpers.startOfWeek(for: newStart)
        }
    }

    private func assign(_ recipeId: String?, to slot: SlotSelection) {
        let plan: MealPlan
        if let existing = currentPlan {
            plan = existing
        } else {
            plan = MealPlan(weekStartDate: weekStart)
            context.insert(plan)
        }
        var dayPlan = plan.dayPlan(at: slot.dayIndex)
        dayPlan.setRecipeId(recipeId, for: slot.mealType)
        plan.setDayPlan(dayPlan, at: slot.dayIndex)
    }
}

/// Selector de receta para asignar a un hueco del plan.
struct RecipePickerView: View {
    @Environment(\.dismiss) private var dismiss

    let recipes: [Recipe]
    let onSelect: (String) -> Void

    @State private var searchText = ""

    private var filtered: [Recipe] {
        guard !searchText.isEmpty else { return recipes }
        return recipes.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        NavigationStack {
            List(filtered) { recipe in
                Button {
                    onSelect(recipe.id)
                    dismiss()
                } label: {
                    RecipeRow(recipe: recipe)
                }
                .buttonStyle(.plain)
            }
            .navigationTitle("Elegir receta")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $searchText, prompt: "Buscar")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
            }
        }
    }
}

#Preview {
    WeeklyPlanView()
        .modelContainer(for: [MealPlan.self, Recipe.self], inMemory: true)
}
