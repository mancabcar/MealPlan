import SwiftUI

struct RecipeDetailView: View {
    let recipe: Recipe

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header
                macrosCard
                section("Ingredientes") {
                    ForEach(recipe.ingredients, id: \.self) { ingredient in
                        Label(ingredient, systemImage: "circle.fill")
                            .labelStyle(BulletLabelStyle())
                    }
                }
                section("Preparación") {
                    ForEach(Array(recipe.instructions.enumerated()), id: \.offset) { index, step in
                        HStack(alignment: .top, spacing: 12) {
                            Text("\(index + 1)")
                                .font(.caption.bold())
                                .frame(width: 24, height: 24)
                                .background(Color.accentColor.opacity(0.15))
                                .clipShape(Circle())
                            Text(step)
                        }
                    }
                }
            }
            .padding()
        }
        .navigationTitle(recipe.name)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(recipe.name)
                .font(.title.bold())
            HStack(spacing: 12) {
                Label("\(recipe.prepTimeMinutes) min", systemImage: "clock")
                if recipe.isAIGenerated {
                    Label("Generada con IA", systemImage: "sparkles")
                        .foregroundStyle(.purple)
                }
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)

            if !recipe.tags.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(recipe.tags, id: \.self) { tag in
                            Text(tag)
                                .font(.caption)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(Color(.systemGray5))
                                .clipShape(Capsule())
                        }
                    }
                }
            }
        }
    }

    private var macrosCard: some View {
        HStack {
            macroItem(value: "\(recipe.calories)", unit: "kcal", color: .orange)
            Divider()
            macroItem(value: "\(Int(recipe.protein))g", unit: "proteína", color: .red)
            Divider()
            macroItem(value: "\(Int(recipe.carbs))g", unit: "carbos", color: .blue)
            Divider()
            macroItem(value: "\(Int(recipe.fat))g", unit: "grasas", color: .yellow)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func macroItem(value: String, unit: String, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.headline)
                .foregroundStyle(color)
            Text(unit)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.title3.bold())
            content()
        }
    }
}

private struct BulletLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            configuration.icon
                .font(.system(size: 6))
                .foregroundStyle(.secondary)
            configuration.title
        }
    }
}
