import SwiftUI
import SwiftData

struct PantryView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \PantryItem.name) private var items: [PantryItem]

    @State private var showingAddSheet = false
    @State private var itemToEdit: PantryItem?

    var body: some View {
        NavigationStack {
            Group {
                if items.isEmpty {
                    ContentUnavailableView {
                        Label("Despensa vacía", systemImage: "refrigerator")
                    } description: {
                        Text("Añade lo que tienes en la nevera, despensa y congelador para recibir sugerencias de recetas.")
                    } actions: {
                        Button("Añadir item") { showingAddSheet = true }
                            .buttonStyle(.borderedProminent)
                    }
                } else {
                    itemList
                }
            }
            .navigationTitle("Despensa")
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
                AddItemView()
            }
            .sheet(item: $itemToEdit) { item in
                AddItemView(itemToEdit: item)
            }
            .task {
                _ = await NotificationService.shared.requestPermission()
            }
        }
    }

    private var itemList: some View {
        List {
            ForEach(PantryCategory.allCases) { category in
                let categoryItems = items.filter { $0.category == category }
                if !categoryItems.isEmpty {
                    Section {
                        ForEach(categoryItems) { item in
                            PantryItemRow(item: item)
                                .contentShape(Rectangle())
                                .onTapGesture { itemToEdit = item }
                        }
                        .onDelete { offsets in
                            delete(offsets, from: categoryItems)
                        }
                    } header: {
                        Label(category.rawValue, systemImage: category.icon)
                    }
                }
            }
        }
    }

    private func delete(_ offsets: IndexSet, from categoryItems: [PantryItem]) {
        for index in offsets {
            let item = categoryItems[index]
            NotificationService.shared.cancelExpiryNotification(for: item)
            context.delete(item)
        }
    }
}

struct PantryItemRow: View {
    let item: PantryItem

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(item.name)
                Text(item.quantity)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if let expiryDate = item.expiryDate {
                expiryBadge(expiryDate)
            }
        }
    }

    @ViewBuilder
    private func expiryBadge(_ date: Date) -> some View {
        let text = Text(date, format: .dateTime.day().month(.abbreviated))
        if item.isExpired {
            Label { text } icon: { Image(systemName: "exclamationmark.triangle.fill") }
                .font(.caption)
                .foregroundStyle(.red)
        } else if item.isExpiringSoon {
            Label { text } icon: { Image(systemName: "clock.fill") }
                .font(.caption)
                .foregroundStyle(.orange)
        } else {
            text
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}

#Preview {
    PantryView()
        .modelContainer(for: PantryItem.self, inMemory: true)
}
