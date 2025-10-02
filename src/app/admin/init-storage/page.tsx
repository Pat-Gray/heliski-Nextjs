"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function InitStoragePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { toast } = useToast();

  const handleInitStorage = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/storage/init-bucket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        setResult('✅ Storage bucket initialized successfully!');
        toast({
          title: "Success!",
          description: "Storage bucket has been initialized.",
        });
      } else {
        setResult(`❌ Error: ${data.error}`);
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      setResult(`❌ Error: ${error.message}`);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Initialize Storage Bucket</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will create the 'gpx' bucket in Supabase Storage if it doesn't exist.
          </p>
          
          <Button 
            onClick={handleInitStorage} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "Initializing..." : "Initialize Storage Bucket"}
          </Button>

          {result && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-mono">{result}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
