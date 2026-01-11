"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Send, X, Minimize, Maximize, AlertTriangle, Trash2, Sparkles, Bot, Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import type { ConversationStage } from "@/lib/ai-service"
import { processChatMessage, planBulkTasks } from "@/lib/ai-service"
import type { ChatMessage } from "@/types"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type ConversationContext = {
  currentTopic: string;
  mentionedTasks: string[];
  userPreferences: Record<string, any>;
  lastAction: string | null;
}

export default function ChatInterface() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hi there! I'm your Unbusy assistant. How can I help you manage your tasks today?",
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [inputRows, setInputRows] = useState(1)
  const [suggestions, setSuggestions] = useState<string[]>([])

  const [conversationStage, setConversationStage] = useState<ConversationStage>("initialGreeting")
  const [taskDetails, setTaskDetails] = useState<any>({})
  const [conversationContext, setConversationContext] = useState<ConversationContext>({
    currentTopic: "taskManagement",
    mentionedTasks: [],
    userPreferences: {},
    lastAction: null
  })

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Load chat history from localStorage
  useEffect(() => {
    if (user) {
      const key = `chat_history_${user.uid}`
      const saved = localStorage.getItem(key)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setMessages(parsed)
          // Try to restore conversation context from last message
          if (parsed.length > 0) {
            const lastMsg = parsed[parsed.length - 1]
            if (lastMsg.context) {
              setConversationContext(lastMsg.context)
            }
          }
        } catch (e) {
          console.error("Failed to parse chat history:", e)
        }
      }
    }
  }, [user])

  // Save chat history to localStorage
  useEffect(() => {
    if (user) {
      const key = `chat_history_${user.uid}`
      const slice = messages.slice(-20).map(msg => ({
        ...msg,
        context: conversationContext
      }))
      localStorage.setItem(key, JSON.stringify(slice))
    }
  }, [messages, user, conversationContext])

  // Generate suggestions based on conversation stage and context
  useEffect(() => {
    const generateSuggestions = () => {
      const baseSuggestions = {
        initialGreeting: [
          "Create a new task",
          "Show my pending tasks",
          "Show my task analytics",
          "Help me prioritize my tasks",
          "Give me a productivity tip",
        ],
        awaitingTaskDetails: [
          "Yes, create this task",
          "Add high priority",
          "Set deadline to tomorrow",
          "Make it a personal task",
          "Set duration to 30 minutes",
        ],
        decisionMaking: [
          "What methods can I use to decide?",
          "How do I weigh pros and cons?",
          "What factors should I consider?",
          "Help me evaluate my options",
          "What if I'm still unsure?",
        ],
        analytics: [
          "How can I improve my completion rate?",
          "What patterns do you see in my tasks?",
          "Which category am I most productive in?",
          "How do I handle overdue tasks?",
          "What's my best time of day for tasks?",
        ],
        scheduling: [
          "How does the scheduling algorithm work?",
          "What's the best way to schedule my tasks?",
          "How can I optimize my schedule?",
          "Can you explain time blocking?",
          "How do I handle unexpected tasks?",
        ],
        help: [
          "How do I create a task?",
          "How does scheduling work?",
          "Tell me about the analytics",
          "How do I delete a task?",
          "What can you help me with?",
        ],
        awaitingClarification: [
          "Yes",
          "No",
          "Let me explain differently",
          "Actually, never mind",
          "Can you suggest options?"
        ],
        freeConversation: [
          "Tell me more about that",
          "How does that work?",
          "What are the benefits?",
          "Can you give me an example?",
          "What are the alternatives?"
        ]
      }

      let stageSuggestions = baseSuggestions[conversationStage] || baseSuggestions.initialGreeting

      if (conversationContext.mentionedTasks.length > 0) {
        stageSuggestions = [
          ...conversationContext.mentionedTasks.map(task => `Update "${task}"`),
          ...stageSuggestions
        ].slice(0, 5)
      }

      return stageSuggestions
    }

    setSuggestions(generateSuggestions())
  }, [conversationStage, conversationContext])

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!input.trim()) return

    const userMessage: ChatMessage = {
      role: "user",
      content: input,
      context: conversationContext
    }
    const newHistory = [...messages, userMessage]
    setMessages(newHistory)
    setInput("")
    setInputRows(1)
    setIsLoading(true)
    setIsTyping(true)
    setError(null)

    updateContext(userMessage)

    try {
      const res = await processChatMessage(
        input,
        newHistory,
        user?.uid || "anonymous",
        conversationStage,
        taskDetails,
        conversationContext
      )

      const assistantMessage = {
        role: "assistant",
        content: res.response,
        context: res.updatedContext || conversationContext
      }

      setMessages(m => [...m, assistantMessage])
      setConversationStage(res.nextConversationStage)
      setTaskDetails(res.updatedTaskDetails || {})

      if (res.updatedContext) {
        setConversationContext(res.updatedContext)
      }

      if (res.response.includes("?") || res.response.includes("confirm") || res.response.includes("verify")) {
        setConversationStage("awaitingClarification")
      }

    } catch (e: any) {
      console.error("Chat API error:", e)
      const fallbackResponse = generateFallbackResponse(input, messages)

      setMessages(m => [
        ...m,
        {
          role: "assistant",
          content: fallbackResponse,
          context: conversationContext
        },
      ])
    } finally {
      setIsLoading(false)
      setIsTyping(false)
    }
  }

  // Handle bulk planning from multi-line input
  const handlePlanBulk = async () => {
    if (!input.trim()) return

    const userMessage: ChatMessage = {
      role: "user",
      content: input,
      context: conversationContext,
    }

    const newHistory = [...messages, userMessage]
    setMessages(newHistory)
    setInput("")
    setInputRows(1)
    setIsLoading(true)
    setIsTyping(true)
    setError(null)

    try {
      const res = await planBulkTasks(input, user?.uid || "anonymous")

      const assistantMessage = {
        role: "assistant",
        content: res.response,
        context: conversationContext,
      }

      setMessages((m) => [...m, assistantMessage])
      setConversationStage(res.nextConversationStage)
    } catch (e: any) {
      console.error("Bulk plan error:", e)
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "I couldn't process your bulk input. Please try splitting tasks onto separate lines or simplify the input.",
          context: conversationContext,
        },
      ])
    } finally {
      setIsLoading(false)
      setIsTyping(false)
    }
  }

  // Update conversation context based on messages
  const updateContext = (message: ChatMessage) => {
    if (message.role === "user") {
      const newContext = { ...conversationContext }

      const taskMentions = extractTaskMentions(message.content)
      if (taskMentions.length > 0) {
        newContext.mentionedTasks = [...new Set([...newContext.mentionedTasks, ...taskMentions])]
      }

      if (message.content.includes("analytics") || message.content.includes("stats")) {
        newContext.currentTopic = "analytics"
      } else if (message.content.includes("schedule") || message.content.includes("calendar")) {
        newContext.currentTopic = "scheduling"
      }

      newContext.lastAction = "userMessage"
      setConversationContext(newContext)
    }
  }

  const extractTaskMentions = (text: string): string[] => {
    const taskRegex = /(?:task|reminder|todo)\s+(?:called|named|")?([^\"]+)"?/gi
    const matches = []
    let match
    while ((match = taskRegex.exec(text)) !== null) {
      matches.push(match[1])
    }
    return matches
  }

  const generateFallbackResponse = (lastUserMessage: string, history: ChatMessage[]): string => {
    const lastFewMessages = history.slice(-3).map(m => m.content).join(" ")

    if (lastFewMessages.includes("task") && lastFewMessages.includes("create")) {
      return "I'm having trouble creating that task. Could you please check the details and try again?"
    }

    if (conversationContext.mentionedTasks.length > 0) {
      return `I'm not sure about that. Would you like me to help with "${conversationContext.mentionedTasks[0]}" or something else?`
    }

    return "I apologize, I didn't quite understand that. Could you rephrase or ask about something else?"
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const lines = e.target.value.split("\n").length
    const calculatedRows = Math.min(5, Math.max(1, lines))
    setInputRows(calculatedRows)
  }

  const toggleChat = () => {
    setIsOpen(o => !o)
    if (!isOpen) {
      setIsMinimized(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const toggleMinimize = () => setIsMinimized(m => !m)

  const clearChat = () => {
    setMessages([
      {
        role: "assistant",
        content: "Hi there! I'm your Unbusy assistant. How can I help you manage your tasks today?",
      },
    ])
    if (user) {
      localStorage.removeItem(`chat_history_${user.uid}`)
    }
    setConversationStage("initialGreeting")
    setTaskDetails({})
    setConversationContext({
      currentTopic: "taskManagement",
      mentionedTasks: [],
      userPreferences: {},
      lastAction: null
    })
  }

  const applySuggestion = (suggestion: string) => {
    setInput(suggestion)
    inputRef.current?.focus()
  }

  const formatMessageContent = (content: string) => {
    const boldFormatted = content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    const italicFormatted = boldFormatted.replace(/\*(.*?)\*/g, "<em>$1</em>")
    const lineFormatted = italicFormatted.replace(/\n/g, "<br>")
    return lineFormatted
  }

  return (
    <>
      {!isOpen && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleChat}
                className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
                aria-label="Open chat assistant"
              >
                <Bot className="h-6 w-6" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Chat with your AI assistant</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 w-80 md:w-96 rounded-lg border border-border bg-card shadow-xl ${isMinimized ? "h-auto" : "h-[500px] flex flex-col"}`}
        >
          <div className="flex items-center justify-between border-b border-border p-3">
            <div className="flex items-center">
              <Sparkles className="mr-2 h-5 w-5 text-primary" />
              <h3 className="font-medium">Unbusy Assistant</h3>
            </div>
            <div className="flex space-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={clearChat} className="h-8 w-8">
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Clear chat history</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={toggleMinimize} className="h-8 w-8">
                      {isMinimized ? (
                        <Maximize className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      ) : (
                        <Minimize className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isMinimized ? "Maximize" : "Minimize"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={toggleChat} className="h-8 w-8">
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Close chat</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: 'calc(500px - 180px)' }}>
                {error && (
                  <Alert variant="destructive" className="mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={`max-w-[85%] rounded-lg p-3 ${m.role === "user"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "mr-auto bg-secondary text-secondary-foreground"
                        }`}
                    >
                      <p
                        className="whitespace-pre-wrap text-sm"
                        dangerouslySetInnerHTML={{ __html: formatMessageContent(m.content) }}
                      ></p>
                    </div>
                  ))}
                </div>

                {isLoading && (
                  <div className="max-w-[80%] mr-auto rounded-lg bg-secondary p-3 text-secondary-foreground">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                )}

                {isTyping && !isLoading && (
                  <div className="flex items-center space-x-1 mb-2 ml-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {suggestions.length > 0 && !isLoading && (
                <div className="px-3 pb-2 border-t border-border">
                  <div className="flex flex-wrap gap-2 pt-2">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => applySuggestion(suggestion)}
                        className="text-xs bg-secondary hover:bg-secondary/80 text-secondary-foreground px-2 py-1 rounded-full truncate max-w-[150px]"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-border p-3">
                <div className="flex items-center space-x-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your message..."
                    className="flex-1 resize-none rounded-md border border-border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={inputRows}
                    disabled={isLoading}
                  />
                  <Button
                    onClick={handleSendMessage}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                    disabled={isLoading || !input.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                  {(input.includes("\n") || input.includes(";")) && (
                    <Button
                      onClick={handlePlanBulk}
                      variant="outline"
                      className="mr-2 hidden md:inline-flex"
                      disabled={isLoading || !input.trim()}
                    >
                      Plan
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
