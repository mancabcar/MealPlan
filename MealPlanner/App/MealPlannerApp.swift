import SwiftUI
import SwiftData

@main
struct MealPlannerApp: App {

    let container: ModelContainer

    init() {
        do {
            container = try ModelContainer(
                for: UserProfile.self,
                     Recipe.self,
                     MealPlan.self,
                     MealEntry.self,
                     PantryItem.self
            )
        } catch {
            fatalError("No se pudo crear el ModelContainer: \(error)")
        }
        // Carga las recetas base del JSON la primera vez que se abre la app
        RecipeStore.seedIfNeeded(context: container.mainContext)
    }

    var body: some Scene {
        WindowGroup {
            MainTabView()
        }
        .modelContainer(container)
    }
}
