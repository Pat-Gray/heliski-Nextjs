"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, Trash2, FolderOpen, CheckCircle, XCircle } from 'lucide-react';

export default function TestFilesPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runTest = async (testType: string, data: any = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/test-files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testType, ...data }),
      });

      const result = await response.json();
      
      if (result.success) {
        setResults(result);
      } else {
        setError(result.error || 'Test failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const getBucketInfo = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/test-files');
      const result = await response.json();
      
      if (result.success) {
        setResults(result);
      } else {
        setError(result.error || 'Failed to get bucket info');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">File Storage Test</h1>
        <p className="text-muted-foreground">
          Test Supabase file storage operations to ensure files are being stored and retrieved properly.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <Button
          onClick={() => runTest('connection-test')}
          disabled={isLoading}
          className="h-20 flex flex-col items-center gap-2 bg-blue-600 hover:bg-blue-700"
        >
          <CheckCircle className="h-6 w-6" />
          <span>Connection Test</span>
        </Button>

        <Button
          onClick={() => getBucketInfo()}
          disabled={isLoading}
          className="h-20 flex flex-col items-center gap-2"
        >
          <FolderOpen className="h-6 w-6" />
          <span>Get Bucket Info</span>
        </Button>

        <Button
          onClick={() => runTest('create-bucket')}
          disabled={isLoading}
          className="h-20 flex flex-col items-center gap-2 bg-green-600 hover:bg-green-700"
        >
          <CheckCircle className="h-6 w-6" />
          <span>Create Bucket</span>
        </Button>

        <Button
          onClick={() => runTest('upload')}
          disabled={isLoading}
          className="h-20 flex flex-col items-center gap-2"
        >
          <Upload className="h-6 w-6" />
          <span>Test Upload</span>
        </Button>

        <Button
          onClick={() => runTest('structure')}
          disabled={isLoading}
          className="h-20 flex flex-col items-center gap-2"
        >
          <CheckCircle className="h-6 w-6" />
          <span>Test Structure</span>
        </Button>

        <Button
          onClick={() => runTest('cleanup', { filePath: results?.results?.upload?.path })}
          disabled={isLoading || !results?.results?.upload?.path}
          className="h-20 flex flex-col items-center gap-2"
        >
          <Trash2 className="h-6 w-6" />
          <span>Cleanup Test</span>
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <span>Running test...</span>
        </div>
      )}

      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Error:</span>
            </div>
            <p className="text-red-700 mt-1">{error}</p>
          </CardContent>
        </Card>
      )}

      {results && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Test Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Badge variant="outline" className="mb-2">
                    {results.message}
                  </Badge>
                </div>

                {results.results?.bucketInfo && (
                  <div>
                    <h3 className="font-medium mb-2">Bucket Information</h3>
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p><strong>Target Bucket:</strong> {results.results.bucketInfo.targetBucket}</p>
                      <p><strong>Available Buckets:</strong> {results.results.bucketInfo.buckets.length}</p>
                      <p><strong>Bucket Exists:</strong> 
                        <Badge className={`ml-2 ${results.results.bucketInfo.bucketExists ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {results.results.bucketInfo.bucketExists ? 'Yes' : 'No'}
                        </Badge>
                      </p>
                      {results.results.bucketInfo.needsCreation && (
                        <p className="text-orange-600 font-medium mt-2">
                          ⚠️ Bucket needs to be created! Click "Create Bucket" button above.
                        </p>
                      )}
                      <div className="mt-2">
                        {results.results.bucketInfo.buckets.map((bucket: any, index: number) => (
                          <Badge key={index} variant="secondary" className="mr-2">
                            {bucket.name} {bucket.public ? '(public)' : '(private)'}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {results.results?.fileListing && (
                  <div>
                    <h3 className="font-medium mb-2">File Listing</h3>
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p><strong>Total Files:</strong> {results.results.fileListing.totalFiles}</p>
                      {results.results.fileListing.files.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-medium mb-1">Recent Files:</p>
                          <div className="space-y-1">
                            {results.results.fileListing.files.map((file: any, index: number) => (
                              <div key={index} className="text-sm text-gray-600">
                                {file.name} ({file.size} bytes) - {file.lastModified}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {results.results?.structureTest && (
                  <div>
                    <h3 className="font-medium mb-2">Structure Test</h3>
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p className="text-sm font-medium mb-2">Expected File Structure:</p>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div>• GPX: {results.results.structureTest.expectedStructure.gpx}</div>
                        <div>• Run Photos: {results.results.structureTest.expectedStructure.runPhotos}</div>
                        <div>• Avalanche Photos: {results.results.structureTest.expectedStructure.avalanchePhotos}</div>
                        <div>• Additional Photos: {results.results.structureTest.expectedStructure.additionalPhotos}</div>
                      </div>
                    </div>
                  </div>
                )}

                {results.results?.testCases && (
                  <div>
                    <h3 className="font-medium mb-2">Generated File Paths</h3>
                    <div className="bg-gray-50 p-3 rounded-md">
                      {results.results.testCases.map((testCase: any, index: number) => (
                        <div key={index} className="text-sm mb-2">
                          <strong>{testCase.fieldName}:</strong> {testCase.generatedPath}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.results?.upload && (
                  <div>
                    <h3 className="font-medium mb-2">Upload Test</h3>
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p><strong>Status:</strong> {results.results.upload.status}</p>
                      <p><strong>URL:</strong> <a href={results.results.upload.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{results.results.upload.url}</a></p>
                      <p><strong>Path:</strong> {results.results.upload.path}</p>
                      {results.results.upload.error && (
                        <p className="text-red-600"><strong>Error:</strong> {results.results.upload.error}</p>
                      )}
                    </div>
                  </div>
                )}

                {results.results?.download && (
                  <div>
                    <h3 className="font-medium mb-2">Download Test</h3>
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p><strong>Success:</strong> {results.results.download.success ? 'Yes' : 'No'}</p>
                      {results.results.download.content && (
                        <p><strong>Content:</strong> {results.results.download.content}</p>
                      )}
                      {results.results.download.error && (
                        <p className="text-red-600"><strong>Error:</strong> {results.results.download.error}</p>
                      )}
                    </div>
                  </div>
                )}

                {results.results?.bucketName && (
                  <div>
                    <h3 className="font-medium mb-2">Bucket Creation</h3>
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p><strong>Bucket Name:</strong> {results.results.bucketName}</p>
                      <p><strong>Exists:</strong> 
                        <Badge className={`ml-2 ${results.results.exists ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {results.results.exists ? 'Yes' : 'No'}
                        </Badge>
                      </p>
                      <p><strong>Action:</strong> 
                        <Badge variant="outline" className="ml-2">
                          {results.results.action}
                        </Badge>
                      </p>
                      {results.results.data && (
                        <p><strong>Data:</strong> <code className="text-sm">{JSON.stringify(results.results.data)}</code></p>
                      )}
                    </div>
                  </div>
                )}

                {results.results?.environment && (
                  <div>
                    <h3 className="font-medium mb-2">Connection Test Results</h3>
                    <div className="bg-gray-50 p-3 rounded-md space-y-3">
                      <div>
                        <h4 className="font-medium text-sm mb-1">Environment Variables</h4>
                        <div className="text-sm space-y-1">
                          <p><strong>Supabase URL:</strong> {results.results.environment.supabaseUrl || 'Not set'}</p>
                          <p><strong>Anon Key:</strong> {results.results.environment.hasAnonKey ? 'Set' : 'Not set'} ({results.results.environment.anonKeyLength} chars)</p>
                        </div>
                      </div>

                      {results.results.storage && (
                        <div>
                          <h4 className="font-medium text-sm mb-1">Storage Tests</h4>
                          <div className="text-sm space-y-1">
                            <p><strong>List Buckets:</strong> 
                              <Badge className={`ml-2 ${results.results.storage.listBuckets?.error ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                {results.results.storage.listBuckets?.error ? 'Failed' : 'Success'}
                              </Badge>
                            </p>
                            {results.results.storage.listBuckets?.error && (
                              <p className="text-red-600 text-xs">Error: {results.results.storage.listBuckets.error.message}</p>
                            )}
                            {results.results.storage.listFiles && (
                              <p><strong>List Files:</strong> 
                                <Badge className={`ml-2 ${results.results.storage.listFiles?.error ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                  {results.results.storage.listFiles?.error ? 'Failed' : 'Success'}
                                </Badge>
                                {results.results.storage.listFiles.bucket && (
                                  <span className="text-xs text-gray-600 ml-2">(from {results.results.storage.listFiles.bucket})</span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {results.results.auth && (
                        <div>
                          <h4 className="font-medium text-sm mb-1">Authentication Tests</h4>
                          <div className="text-sm space-y-1">
                            <p><strong>Get Session:</strong> 
                              <Badge className={`ml-2 ${results.results.auth.getSession?.error ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                {results.results.auth.getSession?.error ? 'No Session' : 'Success'}
                              </Badge>
                            </p>
                            <p><strong>Get User:</strong> 
                              <Badge className={`ml-2 ${results.results.auth.getUser?.error ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                {results.results.auth.getUser?.error ? 'No User' : 'Success'}
                              </Badge>
                            </p>
                            {results.results.auth.note && (
                              <p className="text-blue-600 text-xs font-medium">ℹ️ {results.results.auth.note}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
