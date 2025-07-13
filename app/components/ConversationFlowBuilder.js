'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RetellWebClient } from 'retell-client-js-sdk';
import styles from './ConversationFlowBuilder.module.css';

const DraggableComponent = ({ children, ...props }) => {
  const [isMounted, setIsMounted] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  if (!isMounted) return <div ref={ref}>{children}</div>;

  const Draggable = require('react-draggable').default;
  return <Draggable {...props}>{children}</Draggable>;
};

export default function ConversationFlowBuilder() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [callStatus, setCallStatus] = useState('Ready to start voice call');
  const [retellWebClient, setRetellWebClient] = useState(null);
  const [nodes, setNodes] = useState([
    {
      id: 'welcome',
      type: 'welcome',
      title: 'Welcome Message',
      description: 'Hello! How can we help you today?',
      position: { x: 50, y: 20 },
    },
    {
      id: 'new-caller',
      type: 'caller-type',
      title: 'New Caller',
      description: 'I see you\'re a new caller. Let me help you get started.',
      position: { x: 10, y: 180 },
    },
    {
      id: 'existing-client',
      type: 'caller-type',
      title: 'Existing Client',
      description: 'Welcome back! How can I help you today?',
      position: { x: 50, y: 180 },
    },
    {
      id: 'other',
      type: 'caller-type',
      title: 'Other',
      description: 'I’m here to help. Could you tell me more about what you need?',
      position: { x: 90, y: 180 },
    },
  ]);
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    const client = new RetellWebClient();
    setRetellWebClient(client);

    client.on('call_started', () => {
      console.log('call started');
      setCallStatus('Call active - Speak now!');
      setIsCallActive(true);
    });

    client.on('call_ended', () => {
      console.log('call ended');
      setCallStatus('Call ended');
      setIsCallActive(false);
    });

    client.on('update', (update) => {
      console.log('Received update:', update);
      if (update.transcript) {
        const transcriptText = Array.isArray(update.transcript)
          ? update.transcript
              .map((item) => `${item.role === 'agent' ? '🤖 Agent' : '👤 You'}: ${item.content}`)
              .join('\n\n')
          : update.transcript;
        setTranscript(transcriptText);
      }
    });

    client.on('error', (error) => {
      console.error('Retell error:', error);
      setCallStatus(`Error: ${error.message || 'Unknown error'}`);
    });

    return () => client.removeAllListeners();
  }, []);

  const startCall = useCallback(async () => {
    try {
      setCallStatus('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());

      setCallStatus('Creating call...');
      const flowData = {
        nodes,
        connections: [{ parent: 'welcome', children: ['new-caller', 'existing-client', 'other'] }],
      };

      const response = await fetch('https://retell-flow-backend.vercel.app/create-web-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          captureDeviceId: 'default',
          playbackDeviceId: 'default',
        });
      }

      setCallStatus('Call starting...');
    } catch (error) {
      console.error('Error starting call:', error);
      setCallStatus(
        error.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone access and try again.'
          : `Error: ${error.message}`
      );
    }
  }, [retellWebClient, nodes]);

  const stopCall = useCallback(async () => {
    try {
      if (retellWebClient) {
        await retellWebClient.stopCall();
      }
      setCallStatus('Call stopped');
      setIsCallActive(false);
    } catch (error) {
      console.error('Error stopping call:', error);
    }
  }, [retellWebClient]);

  const updateNode = useCallback((nodeId, field, value) => {
    setNodes((prevNodes) =>
      prevNodes.map((node) => (node.id === nodeId ? { ...node, [field]: value } : node))
    );
  }, []);

  const handleNodeDrag = useCallback((nodeId, data) => {
    setNodes((prevNodes) =>
      prevNodes.map((node) =>
        node.id === nodeId ? { ...node, position: { x: data.x, y: data.y } } : node
      )
    );
  }, []);

  const addNode = useCallback((type) => {
    const newNode = {
      id: `node-${Date.now()}`,
      type,
      title: type === 'caller-type' ? 'New Caller Type' : 'New Response',
      description: 'Enter your message here...',
      position: { x: 50, y: 350 },
    };
    setNodes((prevNodes) => [...prevNodes, newNode]);
  }, []);

  const deleteNode = useCallback((nodeId) => {
    if (nodeId === 'welcome') return;
    setNodes((prevNodes) => prevNodes.filter((node) => node.id !== nodeId));
    if (selectedNode === nodeId) setSelectedNode(null);
  }, [selectedNode]);

  const exportFlow = useCallback(() => {
    const flowData = { nodes, connections: [] };
    const dataStr = JSON.stringify(flowData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'conversation-flow.json';
    link.click();
    URL.revokeObjectURL(url);
  }, [nodes]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Conversation Flow Builder</h1>
        <p>Design your conversational workflow with voice AI integration</p>
      </header>

      <div className={styles.mainContent}>
        <div className={styles.flowCanvas}>
          <div className={styles.toolbar}>
            <button onClick={() => addNode('caller-type')} className={`${styles.btn} ${styles.btnCallerType}`}>
              + Add Caller Type
            </button>
            <button onClick={() => addNode('response')} className={`${styles.btn} ${styles.btnResponse}`}>
              + Add Response
            </button>
            <button onClick={exportFlow} className={`${styles.btn} ${styles.btnExport}`}>
              📥 Export
            </button>
          </div>

          <div className={styles.nodesContainer}>
            {nodes.map((node) => (
              <DraggableComponent
