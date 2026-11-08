"use client";

import { EllipsisVertical, Pencil, Eye, EyeOff, Trash2 } from "lucide-react";
import Image from "next/image";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type MenuRowProps = {
  name: string;
  detail: string;
  image?: string | null;
  showImage?: boolean;
  inStock: boolean;
  onTill: boolean;
  busy: boolean;
  onToggleStock: () => void;
  onToggleTill: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

/** One line per item. Marking something sold out mid-service takes a single tap. */
export default function MenuRow({
  name,
  detail,
  image,
  showImage,
  inStock,
  onTill,
  busy,
  onToggleStock,
  onToggleTill,
  onEdit,
  onDelete,
}: MenuRowProps) {
  return (
    <li className="flex items-center gap-3 py-2 border-b border-dashed">
      <button
        type="button"
        onClick={onEdit}
        className={cn(
          "flex items-center flex-1 min-w-0 gap-3 text-left rounded-md active:!scale-[0.99]",
          !onTill && "opacity-55",
        )}
      >
        {showImage && (
          <span className="relative block overflow-hidden rounded-md size-12 shrink-0 bg-muted">
            {image && <Image src={image} alt="" fill sizes="48px" className="object-cover" />}
          </span>
        )}
        <span className="min-w-0">
          <span className="block text-sm font-medium truncate">{name}</span>
          <span className="block text-xs truncate text-muted-foreground">
            {detail}
            {!onTill && ". Hidden from the till"}
          </span>
        </span>
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={inStock}
        aria-label={`${name} in stock`}
        disabled={busy}
        onClick={onToggleStock}
        className={cn(
          "h-9 w-[4.75rem] shrink-0 text-xs font-semibold rounded-md border disabled:opacity-50",
          inStock
            ? "text-muted-foreground border-border hover:bg-accent"
            : "text-attention border-attention bg-attention-soft",
        )}
      >
        {inStock ? "In stock" : "Sold out"}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`More for ${name}`}
            className="flex items-center justify-center -ml-1 rounded-md size-9 shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <EllipsisVertical className="size-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil aria-hidden /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onToggleTill} disabled={busy}>
            {onTill ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            {onTill ? "Hide from till" : "Show on till"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2 aria-hidden /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
