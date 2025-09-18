"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User } from "lucide-react";
import { BASE_URL } from "../config/api";

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  explainedText?: string;
  documentUrl?: string;
}

export default function ChatInterface({ explainedText, documentUrl }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle explained text from document viewer
  useEffect(() => {
    if (explainedText) {
      handleExplainTextRequest(explainedText);
    }
  }, [explainedText]);

  // Function to handle text explanation requests
  const handleExplainTextRequest = async (text: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: `Please explain this clause: "${text}"`,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch(`${BASE_URL}/explain-selection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: text,
          document_context: documentUrl || "legal document"
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get explanation');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.explanation || getExplanationForText(text),
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error explaining text:', error);
      
      // Fallback to mock explanation
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: getExplanationForText(text),
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Mock AI response generator
  const getExplanationForText = (text: string): string => {
    // This would connect to your backend API in a real implementation
    if (text.toLowerCase().includes('non-compete')) {
      return "This non-compete clause restricts your ability to work for competing companies for 12 months after leaving this job, within a 50-mile radius. **Key concerns:** This could significantly limit your career options. Non-compete clauses are not always enforceable and laws vary by state. Consider negotiating a shorter time period or smaller geographic area.";
    } else if (text.toLowerCase().includes('termination')) {
      return "This termination clause allows either party to end the employment with 30 days notice, but the company can terminate you immediately 'for cause.' **What this means:** The company has broad discretion to decide what constitutes 'cause.' This could include minor policy violations. Consider asking for a more specific definition of 'cause' and severance provisions.";
    } else if (text.toLowerCase().includes('confidential')) {
      return "This confidentiality clause requires you to keep company information private, even after you leave. **This is generally reasonable** but make sure it doesn't prevent you from using general skills and knowledge in future roles. The clause should only cover truly confidential business information, not common industry practices.";
    } else {
      return `This clause appears to be a standard provision. Here's what it means in simple terms: ${text.substring(0, 100)}... This type of language is commonly used in legal documents. If you have specific concerns about how this might affect you, I'd be happy to explain further.`;
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    // Simulate API call delay
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: generateResponse(inputValue),
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  // Mock response generator
  const generateResponse = (question: string): string => {
    const lowerQ = question.toLowerCase();
    
    if (lowerQ.includes('salary') || lowerQ.includes('compensation')) {
      return "The contract specifies a base salary of $120,000 per year. This will be paid according to the company's standard payroll schedule. The contract also mentions potential bonuses, but these are at the company's discretion - meaning they're not guaranteed.";
    } else if (lowerQ.includes('benefits')) {
      return "You'll be eligible for the company's standard benefit plans including health insurance, retirement plans, and paid time off. However, the specific details aren't included in this contract - you should ask HR for the employee handbook or benefits summary.";
    } else if (lowerQ.includes('vacation') || lowerQ.includes('time off')) {
      return "The contract mentions paid time off as part of the benefits package, but doesn't specify the amount. This is typically detailed in the employee handbook. Make sure to clarify the vacation policy, sick leave, and any waiting periods before you can use these benefits.";
    } else if (lowerQ.includes('negotiate')) {
      return "Key areas you might consider negotiating: 1) The non-compete clause (duration and geographic scope), 2) Severance provisions, 3) More specific definition of 'cause' for termination, 4) Remote work arrangements, and 5) Professional development budget. Focus on the terms that matter most to your situation.";
    } else {
      return "I'd be happy to help explain any part of this employment agreement. You can ask me about specific clauses, what certain terms mean, or how they might affect you. Feel free to highlight any text in the document and I'll provide a detailed explanation.";
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full bg-white border border-gray-200 rounded-lg flex flex-col shadow-card overflow-hidden">
      {/* Chat Header */}
      <div className="flex-shrink-0 border-b border-gray-200 p-4 bg-gray-50">
        <div className="flex items-center space-x-2 mb-2">
          <div className="p-2 bg-accent/10 rounded-lg">
            <Bot className="w-5 h-5 text-accent" />
          </div>
          <h3 className="text-heading-4 text-gray-900">AI Assistant</h3>
        </div>
        <p className="text-body-small text-gray-500">
          Get instant explanations and clarifications
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4 min-h-full">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full py-12">
              <div className="text-center max-w-xs">
                <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bot className="w-8 h-8 text-accent" />
                </div>
                <p className="text-body-small text-gray-500 mb-2 font-medium">
                  Ready to help!
                </p>
                <p className="text-body-small text-gray-400 leading-relaxed">
                  Highlight text in the document or ask me anything about this employment agreement
                </p>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start space-x-3 ${
                message.type === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.type === 'assistant' && (
                <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 shadow-sm ${
                  message.type === 'user'
                    ? 'bg-primary-blue text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-body-small leading-relaxed whitespace-pre-wrap">
                  {message.content}
                </p>
                <p className={`text-xs mt-2 opacity-75 ${
                  message.type === 'user' ? 'text-blue-200' : 'text-gray-500'
                }`}>
                  {message.timestamp.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>

              {message.type === 'user' && (
                <div className="w-8 h-8 bg-primary-blue rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center shadow-sm">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-100 rounded-xl px-4 py-3 shadow-sm">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-gray-200 p-4 bg-gray-50">
        <div className="flex space-x-3">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask anything about this document..."
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2.5 text-body focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-colors bg-white"
            rows={1}
            style={{ minHeight: '42px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="bg-accent text-white p-2.5 rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 shadow-sm hover:shadow-md"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}