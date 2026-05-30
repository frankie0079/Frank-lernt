"use client";

import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { SortableTile, type SelectedTileItem } from "@/components/sortable-tile";

interface SelectedItemsRailProps {
  selectedIds: string[];
  itemsById: Map<string, SelectedTileItem>;
  onReorder: (newOrder: string[]) => void;
  onRemove: (contentItemId: string) => void;
}

export function SelectedItemsRail({
  selectedIds,
  itemsById,
  onReorder,
  onRemove,
}: SelectedItemsRailProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 400, tolerance: 5 },
    })
  );

  if (selectedIds.length === 0) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = selectedIds.indexOf(String(active.id));
    const newIndex = selectedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(selectedIds, oldIndex, newIndex));
  };

  return (
    <div className="max-w-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={selectedIds} strategy={rectSortingStrategy}>
          <div
            className="grid max-w-full grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-2 pb-1 sm:grid-cols-[repeat(auto-fill,minmax(90px,1fr))]"
            aria-label="Ausgewählte Beiträge"
          >
            {selectedIds.map((id, index) => {
              const item = itemsById.get(id) ?? {
                id: "",
                content_item_id: id,
                sort_order: (index + 1) * 10,
                deleted: true,
                type: null,
                media_url: null,
                thumbnail_url: null,
                caption: null,
                author_name: null,
                author_avatar_url: null,
              };
              return (
                <SortableTile
                  key={id}
                  item={item}
                  index={index}
                  onRemove={onRemove}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
