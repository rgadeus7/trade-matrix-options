export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Trade Matrix Options Collector</h1>
      
      <div className="bg-gray-100 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">API Endpoints</h2>
        
        <div className="space-y-4">
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-medium">Health Check</h3>
            <code className="text-sm text-gray-600">GET /api/health</code>
          </div>
          
          <div className="border-l-4 border-green-500 pl-4">
            <h3 className="font-medium">Collect Options</h3>
            <code className="text-sm text-gray-600">POST /api/collect-options</code>
            <p className="text-sm text-gray-500 mt-1">
              Collect options chain data from TradeStation API
            </p>
          </div>
          
          <div className="border-l-4 border-purple-500 pl-4">
            <h3 className="font-medium">Collection Status</h3>
            <code className="text-sm text-gray-600">GET /api/collection-status</code>
            <p className="text-sm text-gray-500 mt-1">
              Get information about previous collections
            </p>
          </div>
        </div>
      </div>
      
      <div className="mt-8 bg-blue-50 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Example Request</h2>
        <pre className="bg-gray-800 text-green-400 p-4 rounded text-sm overflow-x-auto">
{`POST /api/collect-options
Content-Type: application/json

{
  "symbols": ["$SPX.X", "$SPXW.X"],
  "topRecords": 3,
  "streamDuration": 2000
}`}
        </pre>
      </div>
    </main>
  )
}
