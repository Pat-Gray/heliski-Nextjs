"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface StatusCommentAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  runId: string;
  className?: string;
  autoOpen?: boolean;
}

// PREDEFINED STATUS COMMENTS
// 🎯 CUSTOMIZE THESE: Add your status comments here
const PREDEFINED_COMMENTS = [
  "Good conditions",
  "Clear skies", 
  "Fresh powder",
  "Stable snowpack",
  "All clear",
  "Proceed with caution",
  "Monitor conditions",
  "Poor visibility",
  "High winds",
  "Avalanche risk",
  "Excellent visibility",
  "Light winds",
  "Icy conditions",
  "Closure recommended",
  "Check weather",
  "Reassess later",
  "Wait for improvement",
  "Not recommended",
  "Perfect for skiing",
  "Too dangerous",
  "Snow quality good",
  "Snow quality poor",
  "Temperature rising",
  "Temperature dropping",
  "Cloudy overhead",
  "Sunny conditions",
  "Snowing lightly",
  "Heavy snowfall",
  "Windy conditions",
  "Calm conditions"
];

export const StatusCommentAutocomplete = React.memo(function StatusCommentAutocomplete({
  value,
  onChange,
  onBlur,
  placeholder = "Enter status comment...",
  runId,
  className,
  autoOpen = false
}: StatusCommentAutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Filter suggestions based on input
  const filteredComments = React.useMemo(() => {
    if (!inputValue) {
      return PREDEFINED_COMMENTS;
    }
    
    const searchTerm = inputValue.toLowerCase();
    return PREDEFINED_COMMENTS.filter(comment =>
      comment.toLowerCase().includes(searchTerm)
    );
  }, [inputValue]);

  // Auto-open when autoOpen prop is true
  React.useEffect(() => {
    if (autoOpen && !open) {
      setOpen(true);
    }
  }, [autoOpen, open]);

  // Auto-focus input when popover opens
  React.useEffect(() => {
    if (open) {
      // Use requestAnimationFrame to ensure the DOM is updated
      requestAnimationFrame(() => {
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 50);
      });
    }
  }, [open]);

  // Update input value when prop value changes
  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleSelect = React.useCallback((selectedValue: string) => {
    onChange(selectedValue);
    setInputValue(selectedValue);
    setOpen(false);
    onBlur?.();
  }, [onChange, onBlur]);

  const handleInputChange = React.useCallback((newValue: string) => {
    setInputValue(newValue);
    onChange(newValue);
  }, [onChange]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (!open) {
        setOpen(true);
      } else {
        // If popover is open and there's custom input, select it
        if (inputValue && inputValue.trim() && !PREDEFINED_COMMENTS.includes(inputValue.trim())) {
          e.preventDefault();
          handleSelect(inputValue.trim());
        }
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }, [open, inputValue, handleSelect]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          data-run-id={runId}
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput
            ref={inputRef}
            placeholder="Search comments..."
            value={inputValue}
            onValueChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          <CommandList>
            <CommandEmpty>No comments found.</CommandEmpty>
            <CommandGroup>
              {/* Show custom input option if it's not in predefined comments */}
              {inputValue && inputValue.trim() && !PREDEFINED_COMMENTS.includes(inputValue.trim()) && (
                <CommandItem
                  key="custom-input"
                  value={inputValue.trim()}
                  onSelect={() => handleSelect(inputValue.trim())}
                  className="font-medium text-blue-600"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === inputValue.trim() ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex items-center">
                    &ldquo;{inputValue.trim()}&rdquo; 
                    <span className="ml-2 text-xs text-muted-foreground">(Press Enter)</span>
                  </span>
                </CommandItem>
              )}
              {filteredComments.map((comment) => (
                <CommandItem
                  key={comment}
                  value={comment}
                  onSelect={() => handleSelect(comment)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === comment ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {comment}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});
