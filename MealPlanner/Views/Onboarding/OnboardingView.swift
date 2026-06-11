import SwiftUI
import SwiftData

/// Flujo de primer arranque: se muestra cuando todavía no existe ningún
/// UserProfile y crea uno con los datos básicos al terminar.
struct OnboardingView: View {
    @Environment(\.modelContext) private var context

    @State private var step = 0

    // Datos del perfil que se va a crear
    @State private var name = ""
    @State private var mealsPerDay = 3
    @State private var calorieGoal = 2000
    @State private var proteinGoal = 120
    @State private var carbsGoal = 200
    @State private var fatGoal = 65
    @State private var restrictions: Set<String> = []

    private static let restrictionOptions = [
        "vegetariano", "vegano", "sin gluten", "sin lactosa"
    ]

    var body: some View {
        VStack {
            TabView(selection: $step) {
                welcomeStep.tag(0)
                goalsStep.tag(1)
                preferencesStep.tag(2)
            }
            .tabViewStyle(.page)
            .indexViewStyle(.page(backgroundDisplayMode: .always))

            Button(action: advance) {
                Text(step < 2 ? "Continuar" : "Empezar")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .padding(.horizontal, 24)
            .padding(.bottom, 16)
        }
        .animation(.default, value: step)
    }

    // MARK: - Paso 1: bienvenida

    private var welcomeStep: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "fork.knife.circle.fill")
                .font(.system(size: 80))
                .foregroundStyle(.tint)
            Text("Bienvenido a MealPlanner")
                .font(.largeTitle.bold())
                .multilineTextAlignment(.center)
            Text("Planifica tus comidas, controla tus macros y recibe recetas personalizadas con IA según lo que tengas en la despensa.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)

            TextField("¿Cómo te llamas?", text: $name)
                .textFieldStyle(.roundedBorder)
                .padding(.top, 12)
            Spacer()
            Spacer()
        }
        .padding(.horizontal, 32)
    }

    // MARK: - Paso 2: objetivos

    private var goalsStep: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Tus objetivos diarios")
                .font(.title.bold())
                .padding(.top, 32)
            Text("Podrás ajustarlos cuando quieras desde la pestaña Perfil.")
                .foregroundStyle(.secondary)

            Form {
                Section {
                    Stepper("Comidas al día: \(mealsPerDay)", value: $mealsPerDay, in: 3...4)
                }
                Section("Macros") {
                    goalStepper("Calorías", value: $calorieGoal, unit: "kcal", step: 50, range: 1000...5000)
                    goalStepper("Proteínas", value: $proteinGoal, unit: "g", step: 5, range: 30...300)
                    goalStepper("Carbohidratos", value: $carbsGoal, unit: "g", step: 10, range: 30...500)
                    goalStepper("Grasas", value: $fatGoal, unit: "g", step: 5, range: 20...200)
                }
            }
            .scrollContentBackground(.hidden)
        }
        .padding(.horizontal, 24)
    }

    private func goalStepper(_ label: String, value: Binding<Int>, unit: String,
                             step: Int, range: ClosedRange<Int>) -> some View {
        Stepper(value: value, in: range, step: step) {
            HStack {
                Text(label)
                Spacer()
                Text("\(value.wrappedValue) \(unit)")
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
        }
    }

    // MARK: - Paso 3: restricciones

    private var preferencesStep: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("¿Alguna restricción?")
                .font(.title.bold())
                .padding(.top, 32)
            Text("Las recetas sugeridas las respetarán siempre. Podrás añadir más (y también ingredientes que no te gustan) desde Perfil.")
                .foregroundStyle(.secondary)

            VStack(spacing: 12) {
                ForEach(Self.restrictionOptions, id: \.self) { option in
                    let isSelected = restrictions.contains(option)
                    Button {
                        if isSelected {
                            restrictions.remove(option)
                        } else {
                            restrictions.insert(option)
                        }
                    } label: {
                        HStack {
                            Text(option.capitalized)
                            Spacer()
                            Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(isSelected ? Color.accentColor : .secondary)
                        }
                        .padding()
                        .background(Color(.systemGray6))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, 16)
            Spacer()
        }
        .padding(.horizontal, 24)
    }

    // MARK: - Navegación

    private func advance() {
        if step < 2 {
            step += 1
        } else {
            createProfile()
        }
    }

    private func createProfile() {
        let profile = UserProfile(
            name: name.trimmingCharacters(in: .whitespaces),
            calorieGoal: calorieGoal,
            proteinGoal: proteinGoal,
            carbsGoal: carbsGoal,
            fatGoal: fatGoal,
            dietaryRestrictions: Array(restrictions).sorted(),
            mealsPerDay: mealsPerDay
        )
        context.insert(profile)
        try? context.save()
        // Al guardarse el perfil, MainTabView deja de mostrar el onboarding.
    }
}

#Preview {
    OnboardingView()
        .modelContainer(for: UserProfile.self, inMemory: true)
}
