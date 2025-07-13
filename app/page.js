'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RetellWebClient } from 'retell-client-js-sdk';

export default function ConversationFlowBuilder() {
  // Voice call state
  const [isCallActive, setIsCallActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [callStatus, setCallStatus] = useState('Ready to start voice call');
  const [retellWebClient, setRetellWebClient] = useState(null);
  
  // Flow builder state
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodes, setNodes] = useState([
    {
      id: 'welcome',
      type: 'welcome',
      title: 'Welcome Message',
      description: 'Hello! How can we help you today?',
      position: { x: 50, y: 20 }
    },
    {
      id: 'new-caller',
      type: 'caller-type',
      title: 'New Caller',
      description: 'I see you\'re a new caller. Let me help you get started.',
      position: { x: 10, y: 180 }
    },
    {
      id: 'existing-client',
      type: 'caller-type', 
      title: 'Existing Client',
      description: 'Welcome back! How can I help you today?',
      position: { x: 50, y: 180 }
    },
    {
      id: 'other',
      type: 'caller-type',
      title: 'Other',
      description: 'I\'m here to help. Could you tell me more about what you need?',
      position: { x: 90, y: 180 }
    }
  ]);

  // Initialize Retell client
  useEffect(() => {
    const client = new RetellWebClient();
    setRetellWebClient(client);

    client.on("call_started", () => {
      console.log("call started");
      setCallStatus('Call active - Speak now!');
      setIsCallActive(true);
    });

    client.on("call_ended", () => {
      console.log("call ended");
      setCallStatus('Call ended');
      setIsCallActive(false);
    });

    client.on("update", (update) => {
      console.log("Received update:", update);
      
      if (update.transcript) {
        let transcriptText = '';
        if (typeof update.transcript === 'string') {
          transcriptText = update.transcript;
        } else if (Array.isArray(update.transcript)) {
          transcriptText = update.transcript
            .map(item => `${item.role === 'agent' ? '🤖 Agent' : '👤 You'}: ${item.content}`)
            .join('\n\n');
        }
        setTranscript(transcriptText);
      }
    });

    client.on("error", (error) => {
      console.error("Retell error:", error);
      setCallStatus(`Error: ${error.message || 'Unknown error'}`);
    });

    return () => {
      client.removeAllListeners();
    };
  }, []);

  const startCall = async () => {
    try {
      setCallStatus('Requesting microphone access...');
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      
      setCallStatus('Creating call...');
      
      // Collect flow data
      const flowData = {
        nodes: nodes,
        connections: [
          { parent: 'welcome', children: ['new-caller', 'existing-client', 'other'] }
        ]
      };

      // Call your working backend
      const response = await fetch('https://retell-flow-backend.vercel.app/create-web-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ flowData }),
      });

      const data = await response.json();
      
      if (!data.success || !data.access_token) {
        throw new Error(data.error || 'Failed to get access token');
      }

      if (retellWebClient) {
        await retellWebClient.startCall({
          accessToken: data.access_token,
          sampleRate: 24000,
          captureDeviceId: "default",
          playbackDeviceId: "default"
        });
      }

      setCallStatus('Call starting...');
    } catch (error) {
      console.error('Error starting call:', error);
      if (error.name === 'NotAllowedError') {
        setCallStatus('Microphone access denied. Please allow microphone access and try again.');
      } else {
        setCallStatus(`Error: ${error.message}`);
      }
    }
  };

  const stopCall = async () => {
    try {
      if (retellWebClient) {
        await retellWebClient.stopCall();
      }
      setCallStatus('Call stopped');
      setIsCallActive(false);
    } catch (error) {
      console.error('Error stopping call:', error);
    }
  };

  const updateNode = (nodeId, field, value) => {
    setNodes(nodes.map(node => 
      node.id === nodeId 
        ? { ...node, [field]: value }
        : node
    ));
  };

  const addNode = (type) => {
    const newNode = {
      id: `node-${Date.now()}`,
      type: type,
      title: type === 'caller-type' ? 'New Caller Type' : 'New Response',
      description: 'Enter your message here...',
      position: { x: 50, y: 350 }
    };
    setNodes([...nodes, newNode]);
  };

  const deleteNode = (nodeId) => {
    if (nodeId === 'welcome') return; // Can't delete welcome node
    setNodes(nodes.filter(node => node.id !== nodeId));
    if (selectedNode === nodeId) setSelectedNode(null);
  };

  const exportFlow = () => {
    const flowData = { nodes, connections: [] };
    const dataStr = JSON.stringify(flowData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'conversation-flow.json';
    link.click();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: '30px',
        color: 'white'
      }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '10px' }}>
          Conversation Flow Builder
        </h1>
        <p style={{ fontSize: '1.1rem', opacity: '0.9' }}>
          Design your conversational workflow with voice AI integration
        </p>
      </div>

      {/* Main Content */}
      <div style={{
        display: 'flex',
        gap: '30px',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        
        {/* Flow Canvas */}
        <div style={{
          flex: '2',
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '15px',
          padding: '20px',
          minHeight: '600px',
          position: 'relative',
          backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(102, 126, 234, 0.1) 2px, transparent 0)',
          backgroundSize: '50px 50px'
        }}>
          
          {/* Toolbar */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '20px',
            flexWrap: 'wrap'
          }}>
            <button 
              onClick={() => addNode('caller-type')}
              style={{
                background: 'linear-gradient(135deg, #f093fb, #f5576c)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 20px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              + Add Caller Type
            </button>
            <button 
              onClick={() => addNode('response')}
              style={{
                background: 'linear-gradient(135deg, #4facfe, #00f2fe)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 20px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              + Add Response
            </button>
            <button 
              onClick={exportFlow}
              style={{
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 20px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              📥 Export
            </button>
          </div>

          {/* Flow Nodes */}
          <div style={{ position: 'relative', minHeight: '500px' }}>
            {nodes.map(node => (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node.id)}
                style={{
                  position: 'absolute',
                  left: `${node.position.x}%`,
                  top: `${node.position.y}px`,
                  background: node.type === 'welcome' 
                    ? 'linear-gradient(135deg, #667eea, #764ba2)'
                    : node.type === 'caller-type'
                    ? 'linear-gradient(135deg, #f093fb, #f5576c)' 
                    : 'linear-gradient(135deg, #4facfe, #00f2fe)',
                  color: 'white',
                  borderRadius: '15px',
                  padding: '20px',
                  minWidth: '200px',
                  maxWidth: '300px',
                  cursor: 'pointer',
                  boxShadow: selectedNode === node.id 
                    ? '0 0 0 3px rgba(118, 75, 162, 0.5)'
                    : '0 8px 25px rgba(0, 0, 0, 0.15)',
                  transition: 'all 0.3s ease',
                  border: selectedNode === node.id ? '2px solid #764ba2' : '2px solid transparent'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '15px'
                }}>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    opacity: '0.8'
                  }}>
                    {node.type.replace('-', ' ')}
                  </span>
                  {node.id !== 'welcome' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNode(node.id);
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '25px',
                        height: '25px',
                        cursor: 'pointer',
                        color: 'white',
                        fontSize: '12px'
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={node.title}
                  onChange={(e) => updateNode(node.id, 'title', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    color: 'white',
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    width: '100%',
                    marginBottom: '8px',
                    padding: '5px',
                    borderRadius: '5px',
                    outline: 'none'
                  }}
                />
                <textarea
                  value={node.description}
                  onChange={(e) => updateNode(node.id, 'description', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    color: 'white',
                    fontSize: '0.9rem',
                    width: '100%',
                    minHeight: '60px',
                    padding: '5px',
                    borderRadius: '5px',
                    outline: 'none',
                    resize: 'none'
                  }}
                />
              </div>
            ))}

            {/* Connection Lines */}
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 0
              }}
            >
              {/* Welcome to caller types connections */}
              {nodes.filter(n => n.type === 'caller-type').map(targetNode => {
                const welcomeNode = nodes.find(n => n.id === 'welcome');
                if (!welcomeNode) return null;
                
                return (
                  <line
                    key={`welcome-${targetNode.id}`}
                    x1={`${welcomeNode.position.x + 10}%`}
                    y1={welcomeNode.position.y + 100}
                    x2={`${targetNode.position.x + 10}%`}
                    y2={targetNode.position.y}
                    stroke="rgba(102, 126, 234, 0.6)"
                    strokeWidth="3"
                    strokeDasharray="5,5"
                  />
                );
              })}
            </svg>
          </div>
        </div>

        {/* Voice Controls & Transcript */}
        <div style={{
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          
          {/* Voice Controls */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '15px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <h3 style={{ marginBottom: '20px', color: '#333' }}>Voice Call</h3>
            
            <div
              style={{
                width: '100px',
                height: '100px',
                background: isCallActive 
                  ? 'linear-gradient(135deg, #ff4757, #c44569)'
                  : 'linear-gradient(135deg, #5f27cd, #341f97)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                cursor: 'pointer',
                margin: '0 auto 20px',
                transition: 'all 0.3s ease',
                boxShadow: isCallActive 
                  ? '0 0 30px rgba(255, 71, 87, 0.6)'
                  : '0 0 30px rgba(95, 39, 205, 0.6)',
                animation: isCallActive ? 'pulse 1s infinite' : 'none'
              }}
              onClick={isCallActive ? stopCall : startCall}
            >
              {isCallActive ? '🔴' : '🎤'}
            </div>

            <button
              onClick={isCallActive ? stopCall : startCall}
              style={{
                background: isCallActive 
                  ? 'linear-gradient(135deg, #ff4757, #c44569)'
                  : 'linear-gradient(135deg, #5f27cd, #341f97)',
                color: 'white',
                border: 'none',
                borderRadius: '25px',
                padding: '12px 30px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                marginBottom: '15px',
                transition: 'all 0.3s ease'
              }}
            >
              {isCallActive ? 'End Call' : 'Start Voice Call'}
            </button>

            <div style={{
              background: 'rgba(95, 39, 205, 0.1)',
              borderRadius: '10px',
              padding: '10px',
              fontSize: '14px',
              color: '#333',
              fontWeight: '500'
            }}>
              {callStatus}
            </div>
          </div>

          {/* Transcript */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '15px',
            padding: '20px',
            flex: '1',
            minHeight: '300px'
          }}>
            <h3 style={{ marginBottom: '15px', color: '#333' }}>Live Transcript</h3>
            <div style={{
              background: 'rgba(0, 0, 0, 0.05)',
              borderRadius: '10px',
              padding: '15px',
              height: '250px',
              overflowY: 'auto',
              fontSize: '14px',
              lineHeight: '1.6',
              color: '#333'
            }}>
              {transcript ? (
                <div>
                  {transcript.split('\n\n').map((line, index) => (
                    <div
                      key={index}
                      style={{
                        marginBottom: '10px',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: line.startsWith('🤖 Agent')
                          ? 'rgba(95, 39, 205, 0.1)'
                          : 'rgba(26, 188, 156, 0.1)',
                        border: `1px solid ${line.startsWith('🤖 Agent') ? '#5f27cd' : '#1abc9c'}`
                      }}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  color: 'rgba(0, 0, 0, 0.4)',
                  fontStyle: 'italic',
                  textAlign: 'center',
                  marginTop: '50px'
                }}>
                  Your conversation transcript will appear here...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  );
}
