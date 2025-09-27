"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Settings, Zap } from "lucide-react";

interface AvalancheRiskAssessmentProps {
  onApplyRiskAssessment: (assessment: {
    strategicMindset: string;
    primaryHazard: string;
    secondaryFactors: {
      newSnow: boolean;
      windLoading: boolean;
      temperatureRise: boolean;
      windSpeed: string;
      windDirection: string;
    };
  }) => void;
}

export default function AvalancheRiskAssessment({ onApplyRiskAssessment }: AvalancheRiskAssessmentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [strategicMindset, setStrategicMindset] = useState("Assessment");
  const [primaryHazard, setPrimaryHazard] = useState("Wind Slab");
  const [secondaryFactors, setSecondaryFactors] = useState({
    newSnow: false,
    windLoading: false,
    temperatureRise: false,
    windSpeed: "moderate",
    windDirection: "NW"
  });

  const handleApply = () => {
    onApplyRiskAssessment({
      strategicMindset,
      primaryHazard,
      secondaryFactors
    });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Apply Daily Risk Factors
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Apply Daily Risk Factors
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Strategic Mindset */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Strategic Mindset</label> 
            <Select value={strategicMindset} onValueChange={setStrategicMindset}>
              <SelectTrigger>
                <SelectValue placeholder="Select strategic mindset" />
              </SelectTrigger>
              <SelectContent>
  <SelectItem value="Assessment">Assessment</SelectItem>
  <SelectItem value="Stepping Out">Stepping Out</SelectItem>
  <SelectItem value="Status Quo">Status Quo</SelectItem>
  <SelectItem value="Stepping Back">Stepping Back</SelectItem>
  <SelectItem value="Entrenchment">Entrenchment</SelectItem>
  <SelectItem value="Open Season">Open Season</SelectItem>
  <SelectItem value="High Alert">High Alert</SelectItem>
  <SelectItem value="Spring Diurnal">Spring Diurnal</SelectItem>
</SelectContent>
            </Select>
            
          </div>

          {/* Primary Hazard Assessment */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Primary Hazard Type</label>
            <Select value={primaryHazard} onValueChange={setPrimaryHazard}>
              <SelectTrigger>
                <SelectValue placeholder="Select primary hazard" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Wind Slab">Wind Slab</SelectItem>
                <SelectItem value="Storm Slab">Storm Slab</SelectItem>
                <SelectItem value="Persistent Slab">Persistent Slab</SelectItem>
                <SelectItem value="Wet Slab">Wet Slab</SelectItem>
                <SelectItem value="Loose Snow">Loose Snow</SelectItem>
                <SelectItem value="Glide Avalanche">Glide Avalanche</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Secondary Factors */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Secondary Factors</label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="newSnow"
                  checked={secondaryFactors.newSnow}
                  onCheckedChange={(checked) => 
                    setSecondaryFactors({...secondaryFactors, newSnow: checked as boolean})
                  }
                />
                <label htmlFor="newSnow" className="text-sm">New Snow (24-48hrs)</label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="windLoading"
                  checked={secondaryFactors.windLoading}
                  onCheckedChange={(checked) => 
                    setSecondaryFactors({...secondaryFactors, windLoading: checked as boolean})
                  }
                />
                <label htmlFor="windLoading" className="text-sm">Wind Loading</label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="temperatureRise"
                  checked={secondaryFactors.temperatureRise}
                  onCheckedChange={(checked) => 
                    setSecondaryFactors({...secondaryFactors, temperatureRise: checked as boolean})
                  }
                />
                <label htmlFor="temperatureRise" className="text-sm">Temperature Rise</label>
              </div>
            </div>
          </div>

{/* Wind Direction */}
<div className="space-y-3">
  <label className="text-sm font-medium text-foreground">Wind Direction</label>
  <Select 
    value={secondaryFactors.windDirection} 
    onValueChange={(value) => 
      setSecondaryFactors({...secondaryFactors, windDirection: value})
    }
  >
    <SelectTrigger>
      <SelectValue placeholder="Select wind direction" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="N">North (N)</SelectItem>
      <SelectItem value="NE">Northeast (NE)</SelectItem>
      <SelectItem value="E">East (E)</SelectItem>
      <SelectItem value="SE">Southeast (SE)</SelectItem>
      <SelectItem value="S">South (S)</SelectItem>
      <SelectItem value="SW">Southwest (SW)</SelectItem>
      <SelectItem value="W">West (W)</SelectItem>
      <SelectItem value="NW">Northwest (NW)</SelectItem>
    </SelectContent>
  </Select>
</div>

          {/* Wind Speed */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Wind Speed</label>
            <Select 
              value={secondaryFactors.windSpeed} 
              onValueChange={(value) => 
                setSecondaryFactors({...secondaryFactors, windSpeed: value})
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select wind speed" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="calm">Calm (0-10 km/h)</SelectItem>
                <SelectItem value="light">Light (10-20 km/h)</SelectItem>
                <SelectItem value="moderate">Moderate (20-40 km/h)</SelectItem>
                <SelectItem value="strong">Strong (40-60 km/h)</SelectItem>
                <SelectItem value="very-strong">Very Strong (60+ km/h)</SelectItem>
              </SelectContent>
            </Select>
          </div>


          
          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button onClick={handleApply} className="flex-1">
              <Zap className="w-4 h-4 mr-2" />
              Apply to Run Status
            </Button>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
