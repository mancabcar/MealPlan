import SwiftUI
import SwiftData

struct MainTabView: View {
    @Query private var profiles: [UserProfile]

    var body: some View {
        if profiles.isEmpty {
            // Primer arranque: el onboarding crea el UserProfile y, al guardarse,
            // esta vista pasa automáticamente a mostrar las pestañas.
            OnboardingView()
                .transition(.opacity)
        } else {
            TabView {
                DiaryView()
                    .tabItem {
                        Label("Hoy", systemImage: "fork.knife")
                    }

                WeeklyPlanView()
                    .tabItem {
                        Label("Plan", systemImage: "calendar")
                    }

                RecipesView()
                    .tabItem {
                        Label("Recetas", systemImage: "book.closed")
                    }

                PantryView()
                    .tabItem {
                        Label("Despensa", systemImage: "refrigerator")
                    }

                ProfileView()
                    .tabItem {
                        Label("Perfil", systemImage: "person.circle")
                    }
            }
        }
    }
}

#Preview {
    MainTabView()
        .modelContainer(for: [UserProfile.self, Recipe.self, MealPlan.self, MealEntry.self, PantryItem.self], inMemory: true)
}
