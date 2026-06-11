import SwiftUI
import SwiftData

struct AddMealEntryView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \Recipe.name) private var recipes: [Recipe]

    let date: Date

    @State private var mealType: MealType = .lunch
    @State private var mode: EntryMode = .recipe
    @State private var selectedRecipeId: String?
    @State private var customName = ""
    @State private var calories = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""

    enum EntryMode: String, CaseIterable, Identifiable {
        case recipe = "Receta guardada"
        case custom = "Entrada libre"
        var id: String { rawValue }
    }

    private var selectedRecipe: Recipe? {
        recipes.first { $0.id == selectedRecipeId }
    }

    private var canSave: Bool {
        switch mode {
        case .recipe:
            return selectedRecipe != nil
        case .custom:
            return !customName.trimmingCharacters(in: .whitespaces).isEmpty && Int(calories) != nil
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Picker("Comida", selection: $mealType) {
                    ForEach(MealType.allCases) { type in
                        Label(type.rawValue, systemImage: type.icon).tag(type)
                    }
                }

                Picker("Tipo de entrada", selection: $mode.animation()) {
                    ForEach(EntryMode.allCases) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)

                switch mode {
                case .recipe:
                    Section("Receta") {
                        Picker("Elige una receta", selection: $selectedRecipeId) {
                            Text("Sin seleccionar").tag(String?.none)
                            ForEach(recipes) { recipe in
                                Text("\(recipe.name) (\(recipe.calories) kcal)")
                                    .tag(String?.some(recipe.id))
                            }
                        }
                        .pickerStyle(.navigationLink)
                    }
                case .custom:
                    Section("Qué has comido") {
                        TextField("Nombre (ej. bocadillo de atún)", text: $customName)
                        TextField("Calorías (kcal)", text: $calories)
                            .keyboardType(.numberPad)
                        TextField("Proteínas (g)", text: $protein)
                            .keyboardType(.decimalPad)
                        TextField("Carbohidratos (g)", text: $carbs)
                            .keyboardType(.decimalPad)
                        TextField("Grasas (g)", text: $fat)
                            .keyboardType(.decimalPad)
                    }
                }
            }
            .navigationTitle("Registrar comida")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") { save() }
                        .disabled(!canSave)
                }
            }
        }
    }

    private func save() {
        let entry: MealEntry
        switch mode {
        case .recipe:
            guard let recipe = selectedRecipe else { return }
            entry = MealEntry(
                date: date,
                mealType: mealType,
                recipeId: recipe.id,
                customName: recipe.name,
                calories: recipe.calories,
                protein: recipe.protein,
                carbs: recipe.carbs,
                fat: recipe.fat
            )
        case .custom:
            entry = MealEntry(
                date: date,
                mealType: mealType,
                customName: customName.trimmingCharacters(in: .whitespaces),
                calories: Int(calories) ?? 0,
                protein: Double(protein) ?? 0,
                carbs: Double(carbs) ?? 0,
                fat: Double(fat) ?? 0
            )
        }
        context.insert(entry)
        dismiss()
    }
}

#Preview {
    AddMealEntryView(date: .now)
        .modelContainer(for: [Recipe.self, MealEntry.self], inMemory: true)
}
