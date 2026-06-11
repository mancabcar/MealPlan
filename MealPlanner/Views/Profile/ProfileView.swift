import SwiftUI
import SwiftData

struct ProfileView: View {
    @Environment(\.modelContext) private var context
    @Query private var profiles: [UserProfile]

    @State private var newRestriction = ""
    @State private var newDisliked = ""

    private var profile: UserProfile? { profiles.first }

    var body: some View {
        NavigationStack {
            Group {
                if let profile {
                    profileForm(profile)
                } else {
                    ContentUnavailableView {
                        Label("Sin perfil", systemImage: "person.crop.circle.badge.plus")
                    } description: {
                        Text("Crea tu perfil para personalizar recetas y objetivos.")
                    } actions: {
                        Button("Crear perfil") {
                            context.insert(UserProfile())
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
            }
            .navigationTitle("Perfil")
        }
    }

    @ViewBuilder
    private func profileForm(_ profile: UserProfile) -> some View {
        Form {
            Section("Datos") {
                TextField("Nombre", text: Bindable(profile).name)
                Stepper("Comidas al día: \(profile.mealsPerDay)",
                        value: Bindable(profile).mealsPerDay, in: 3...4)
            }

            Section("Objetivos diarios") {
                LabeledStepper(label: "Calorías", unit: "kcal",
                               value: Bindable(profile).calorieGoal, step: 50, range: 1000...5000)
                LabeledStepper(label: "Proteínas", unit: "g",
                               value: Bindable(profile).proteinGoal, step: 5, range: 30...300)
                LabeledStepper(label: "Carbohidratos", unit: "g",
                               value: Bindable(profile).carbsGoal, step: 10, range: 30...500)
                LabeledStepper(label: "Grasas", unit: "g",
                               value: Bindable(profile).fatGoal, step: 5, range: 20...200)
            }

            Section("Restricciones dietéticas") {
                ForEach(profile.dietaryRestrictions, id: \.self) { restriction in
                    Text(restriction)
                }
                .onDelete { profile.dietaryRestrictions.remove(atOffsets: $0) }

                HStack {
                    TextField("Ej. vegetariano, sin gluten...", text: $newRestriction)
                    Button("Añadir") {
                        addItem(newRestriction, to: Bindable(profile).dietaryRestrictions)
                        newRestriction = ""
                    }
                    .disabled(newRestriction.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }

            Section("Ingredientes que no te gustan") {
                ForEach(profile.dislikedIngredients, id: \.self) { ingredient in
                    Text(ingredient)
                }
                .onDelete { profile.dislikedIngredients.remove(atOffsets: $0) }

                HStack {
                    TextField("Ej. jamón, judías verdes...", text: $newDisliked)
                    Button("Añadir") {
                        addItem(newDisliked, to: Bindable(profile).dislikedIngredients)
                        newDisliked = ""
                    }
                    .disabled(newDisliked.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private func addItem(_ text: String, to list: Binding<[String]>) {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, !list.wrappedValue.contains(trimmed) else { return }
        list.wrappedValue.append(trimmed)
    }
}

/// Stepper con valor y unidad visibles, para los objetivos de macros.
private struct LabeledStepper: View {
    let label: String
    let unit: String
    @Binding var value: Int
    let step: Int
    let range: ClosedRange<Int>

    var body: some View {
        Stepper(value: $value, in: range, step: step) {
            HStack {
                Text(label)
                Spacer()
                Text("\(value) \(unit)")
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
        }
    }
}

#Preview {
    ProfileView()
        .modelContainer(for: UserProfile.self, inMemory: true)
}
