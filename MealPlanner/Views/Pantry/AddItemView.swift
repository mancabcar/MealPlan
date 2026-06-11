import SwiftUI
import SwiftData

struct AddItemView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    var itemToEdit: PantryItem?

    @State private var name = ""
    @State private var quantity = ""
    @State private var category: PantryCategory = .fridge
    @State private var hasExpiryDate = false
    @State private var expiryDate = Calendar.current.date(byAdding: .day, value: 7, to: .now) ?? .now

    private var isEditing: Bool { itemToEdit != nil }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Nombre (ej. pechuga de pollo)", text: $name)
                    TextField("Cantidad (ej. 200g, 1 bote)", text: $quantity)
                    Picker("Dónde está", selection: $category) {
                        ForEach(PantryCategory.allCases) { category in
                            Label(category.rawValue, systemImage: category.icon)
                                .tag(category)
                        }
                    }
                }

                Section {
                    Toggle("Tiene fecha de caducidad", isOn: $hasExpiryDate.animation())
                    if hasExpiryDate {
                        DatePicker("Caduca el", selection: $expiryDate, displayedComponents: .date)
                    }
                }
            }
            .navigationTitle(isEditing ? "Editar item" : "Nuevo item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") { save() }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear { loadItemIfEditing() }
        }
    }

    private func loadItemIfEditing() {
        guard let item = itemToEdit else { return }
        name = item.name
        quantity = item.quantity
        category = item.category
        if let date = item.expiryDate {
            hasExpiryDate = true
            expiryDate = date
        }
    }

    private func save() {
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        let finalExpiry = hasExpiryDate ? expiryDate : nil

        if let item = itemToEdit {
            NotificationService.shared.cancelExpiryNotification(for: item)
            item.name = trimmedName
            item.quantity = quantity
            item.category = category
            item.expiryDate = finalExpiry
            NotificationService.shared.scheduleExpiryNotification(for: item)
        } else {
            let item = PantryItem(
                name: trimmedName,
                quantity: quantity,
                expiryDate: finalExpiry,
                category: category
            )
            context.insert(item)
            NotificationService.shared.scheduleExpiryNotification(for: item)
        }
        dismiss()
    }
}

#Preview {
    AddItemView()
        .modelContainer(for: PantryItem.self, inMemory: true)
}
