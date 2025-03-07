const { useState, useEffect, useMemo } = React;
const room = new WebsimSocket();

function App() {
  const [activeTab, setActiveTab] = useState('create');
  const [signPrompt, setSignPrompt] = useState('');
  const [signDescription, setSignDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSignData, setGeneratedSignData] = useState(null);
  const [error, setError] = useState('');
  
  // Get all signs from the collection
  const signs = React.useSyncExternalStore(
    room.collection('traffic_sign').subscribe,
    room.collection('traffic_sign').getList
  );
  
  // Function to generate a traffic sign
  const generateTrafficSign = async () => {
    setError('');
    
    if (!signPrompt.trim()) {
      setError('Please enter a description for the traffic sign');
      return;
    }
    
    try {
      setIsGenerating(true);
      
      // Use the LLM to create a better prompt for image generation
      const completion = await websim.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a traffic sign design expert. Create a detailed visual description of a fictional but realistic-looking traffic sign based on the user's input. 
            Make it visually clear, using standard traffic sign elements like shapes, colors, and symbols typical for road signage.
            Focus on creating a sign that could plausibly exist, following design principles of real traffic signs.
            Respond directly with JSON, following this JSON schema, and no other text:
            {
              "prompt": "A detailed visual description of the traffic sign for image generation",
              "shape": "circle|triangle|rectangle|octagon|diamond|etc",
              "mainColor": "red|yellow|blue|green|white|orange|etc",
              "purpose": "A brief explanation of what this sign would communicate to drivers"
            }`
          },
          {
            role: "user",
            content: signPrompt
          },
        ],
        json: true
      });
      
      const signDetails = JSON.parse(completion.content);
      
      // Generate the image using the enhanced prompt
      const imageResult = await websim.imageGen({
        prompt: `A realistic traffic sign: ${signDetails.prompt}. Clear, professional road sign design, high contrast, on a plain background.`,
        aspect_ratio: "1:1"
      });

      // Get the creator's username
      let creatorUsername = (await window.websim.getCreatedBy()).username;
      
      // Create a new sign record
      const newSign = await room.collection('traffic_sign').create({
        title: signPrompt,
        description: signDescription || 'No description provided',
        imageUrl: imageResult.url,
        shape: signDetails.shape,
        mainColor: signDetails.mainColor,
        purpose: signDetails.purpose,
        creator: creatorUsername
      });
      
      setGeneratedSignData(newSign);
      setActiveTab('view');
      
    } catch (err) {
      console.error('Error generating traffic sign:', err);
      setError('Failed to generate traffic sign. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    await generateTrafficSign();
  };
  
  const resetForm = () => {
    setSignPrompt('');
    setSignDescription('');
    setGeneratedSignData(null);
    setActiveTab('create');
  };
  
  // Sort signs by creation date (newest first)
  const sortedSigns = useMemo(() => {
    return [...signs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [signs]);
  
  return (
    <div className="container">
      <h1>Traffic Sign Generator</h1>
      
      <div className="tabs">
        <div 
          className={`tab ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Create New Sign
        </div>
        <div 
          className={`tab ${activeTab === 'view' ? 'active' : ''}`}
          onClick={() => setActiveTab('view')}
        >
          View Latest Sign
        </div>
        <div 
          className={`tab ${activeTab === 'gallery' ? 'active' : ''}`}
          onClick={() => setActiveTab('gallery')}
        >
          Sign Gallery
        </div>
      </div>
      
      {activeTab === 'create' && (
        <div className="form-container">
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="sign-prompt">What kind of traffic sign do you want?</label>
              <input
                id="sign-prompt"
                type="text"
                value={signPrompt}
                onChange={(e) => setSignPrompt(e.target.value)}
                placeholder="e.g., A sign warning about falling coconuts"
                required
              />
            </div>
            
            <div className="input-group">
              <label htmlFor="sign-description">Additional description (optional)</label>
              <textarea
                id="sign-description"
                value={signDescription}
                onChange={(e) => setSignDescription(e.target.value)}
                placeholder="Add any additional details about your sign here..."
              />
            </div>
            
            {error && <div className="error">{error}</div>}
            
            <button type="submit" disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate Traffic Sign'}
            </button>
          </form>
          
          {isGenerating && (
            <div className="loading">
              <p>Creating your traffic sign...</p>
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'view' && generatedSignData && (
        <div className="sign-display">
          <div className="sign-container">
            <img src={generatedSignData.imageUrl} alt={generatedSignData.title} className="sign-image" />
          </div>
          
          <div className="sign-details">
            <h3>{generatedSignData.title}</h3>
            <p><strong>Purpose:</strong> {generatedSignData.purpose}</p>
            <p><strong>Shape:</strong> {generatedSignData.shape}</p>
            <p><strong>Main Color:</strong> {generatedSignData.mainColor}</p>
            {generatedSignData.description && (
              <p><strong>Description:</strong> {generatedSignData.description}</p>
            )}
            <div className="sign-meta">
              <span>Created by: {generatedSignData.creator || 'Anonymous'}</span>
              <span>Created: {new Date(generatedSignData.created_at).toLocaleString()}</span>
            </div>
            <button onClick={resetForm} style={{marginTop: '15px'}}>Create Another Sign</button>
          </div>
        </div>
      )}
      
      {activeTab === 'gallery' && (
        <div className="gallery">
          <h2>Traffic Sign Gallery</h2>
          {sortedSigns.length === 0 ? (
            <p>No traffic signs have been created yet. Be the first!</p>
          ) : (
            <div className="gallery-container">
              {sortedSigns.map(sign => (
                <div key={sign.id} className="gallery-item">
                  <img src={sign.imageUrl} alt={sign.title} className="gallery-image" />
                  <div className="gallery-details">
                    <h4>{sign.title}</h4>
                    <p>Created by: {sign.creator || 'Anonymous'}</p>
                    <p>{new Date(sign.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('app')).render(<App />);

