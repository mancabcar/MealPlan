import SwiftUI
import SwiftData

struct RecipesView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Recipe.name) private var recipes: [Recipe]
    @Query private var profiles: [UserProfile]
    @Query private var pantryItems: [PantryItem]

    @State private var searchText = ""
    @State private var selectedTag: String?
    @State private var isGenerating = false
    @State private var errorMessage: String?

    private var allTags: [String] {
        Array(Set(recipes.flatMap(\.tags))).sorted()
    }

    private var filteredRecipes: [Recipe] {
        recipes.filter { recipe in
            let matchesSearch = searchText.isEmpty
                || recipe.name.localizedCaseInsensitiveContains(searchText)
                || recipe.ingredients.contains { $0.localizedCaseInsensitiveContains(searchText) }
            let matchesTag = selectedTag == nil || recipe.tags.contains(selectedTag!)
            return matchesSearch && matchesTag
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if recipes.isEmpty {
                    ContentUnavailableView(
                        "Sin recetas",
                        systemImage: "book.closed",
                        description: Text("Las recetas base se cargan al iniciar la app.")
                    )
                } else {
                    recipeList
                }
            }
            .navigationTitle("Recetas")
            .searchable(text: $searchText, prompt: "Buscar receta o ingrediente")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    suggestButton
                }
            }
            .alert("No se pudieron generar recetas", isPresented: .init(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("Aceptar", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    /// Botón "Sugerir recetas": pide a Claude recetas según el perfil y la despensa.
    private var suggestButton: some View {
        Button {
            generateAIRecipes()
        } label: {
            if isGenerating {
                ProgressView()
            } else {
                Label("Sugerir recetas", systemImage: "sparkles")
            }
        }
        .disabled(isGenerating)
    }

    private func generateAIRecipes() {
        guard let profile = profiles.first else {
            errorMessage = "Crea primero tu perfil (pestaña Perfil) para personalizar las sugerencias."
            return
        }
        isGenerating = true
        Task {
            defer { isGenerating = false }
            do {
                let dtos = try await ClaudeService().generateRecipes(
                    profile: profile,
                    pantryItems: pantryItems
                )
                for dto in dtos {
                    context.insert(dto.toModel())
                }
                try context.save()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private var recipeList: some View {
        VStack(spacing: 0) {
            tagFilterBar
            List(filteredRecipes) { recipe in
                NavigationLink(value: recipe.id) {
                    RecipeRow(recipe: recipe)
                }
            }
            .listStyle(.plain)
            .navigationDestination(for: String.self) { recipeId in
                if let recipe = recipes.first(where: { $0.id == recipeId }) {
                    RecipeDetailView(recipe: recipe)
                }
            }
            .overlay {
                if filteredRecipes.isEmpty {
                    ContentUnavailableView.search(text: searchText)
                }
            }
        }
    }

    private var tagFilterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(allTags, id: \.self) { tag in
                    let isSelected = selectedTag == tag
                    Button {
                        selectedTag = isSelected ? nil : tag
                    } label: {
                        Text(tag)
                            .font(.caption)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(isSelected ? Color.accentColor : Color(.systemGray5))
                            .foregroundStyle(isSelected ? .white : .primary)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
    }
}

struct RecipeRow: View {
    let recipe: Recipe

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(recipe.name)
                    .font(.headline)
                if recipe.isAIGenerated {
                    Image(systemName: "sparkles")
                        .font(.caption)
                        .foregroundStyle(.purple)
                }
            }
            HStack(spacing: 12) {
                Label("\(recipe.prepTimeMinutes) min", systemImage: "clock")
                Label("\(recipe.calories) kcal", systemImage: "flame")
                Text("P \(Int(recipe.protein))g · C \(Int(recipe.carbs))g · G \(Int(recipe.fat))g")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}

#Preview {
    RecipesView()
        .modelContainer(for: [Recipe.self, UserProfile.self, PantryItem.self], inMemory: true)
}
