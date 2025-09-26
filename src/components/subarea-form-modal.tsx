"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface SubAreaFormModalProps {
  preselectedAreaId?: string;
}

export default function SubAreaFormModal({ preselectedAreaId }: SubAreaFormModalProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createSubAreaMutation = useMutation({
    mutationFn: async (subAreaData: { name: string; areaId: string }) => {
      return await apiRequest("POST", "/api/sub-areas", subAreaData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-areas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/areas"] });
      toast({ title: "Sub-area created successfully" });
      setOpen(false);
      setName("");
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to create sub-area", 
        description: error.message || "An error occurred",
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !preselectedAreaId) return;
    
    createSubAreaMutation.mutate({
      name: name.trim(),
      areaId: preselectedAreaId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Sub-Area
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Sub-Area</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="text-sm font-medium">
              Sub-Area Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter sub-area name"
              required
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={createSubAreaMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createSubAreaMutation.isPending || !name.trim() || !preselectedAreaId}
            >
              {createSubAreaMutation.isPending ? "Creating..." : "Create Sub-Area"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
