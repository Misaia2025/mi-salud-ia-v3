"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
// --- Supabase client ---
import { supabase } from "@/lib/supabase"

// ---------------------------------------------------------
//  SUPABASE HELPERS: historial + control de tokens
// ---------------------------------------------------------
async function getUserId(): Promise<string> {
  // 1. ¿Está logueado?
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.id) return user.id

  // 2. Si es anónimo, recicla o crea un ID local
  let anon = localStorage.getItem("anon_id")
  if (!anon) {
    anon = `anon_${Date.now()}`
    localStorage.setItem("anon_id", anon)
  }
  return anon
}

async function saveConsultation({
  symptoms,
  age,
  sex,
  conditions,
  aiText
}: {
  symptoms: string
  age: number
  sex: string
  conditions: string
  aiText: string
}) {
  const uid = await getUserId()

  // 1️⃣  Guarda la consulta en history
  await supabase.from("history").insert({
    user_id: uid,
    symptoms,
    age,
    sex,
    conditions,
    ai_text: aiText
  })

  // 2️⃣  Incrementa el contador en tokens
  // upsert = inserta si no existe, actualiza si existe
  const { data, error } = await supabase
    .from("tokens")
    .upsert(
      { user_id: uid, used: 1 },
      { onConflict: "user_id", ignoreDuplicates: false, returning: "representation" }
    )

  if (error) {
    console.error("Error actualizando tokens:", error.message)
    return { used: 0 }
  }

  const used = data?.[0]?.used ?? 1
  return { used } // cuántos lleva usados
}


import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Mic,
  MessageCircle,
  Check,
  ArrowLeft,
  Heart,
  HelpCircle,
  Shield,
  X,
  Sparkles,
  Edit3,
  Send,
  User,
  Calendar,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Volume2,
  VolumeX,
  Stethoscope,
  Droplet,
  CreditCard,
  Loader2,
  LogIn,
  MapPin,
  History,
} from "lucide-react"

import jsPDF from "jspdf"

type Screen =
  | "welcome"
  | "recording"
  | "demographics-age"
  | "demographics-gender"
  | "confirmation"
  | "response"
  | "learn-more"
  | "chat"
  | "upload"
  | "demographics-conditions"
  | "token-limit"
  | "purchase-tokens"
  | "payment-processing"
  | "payment-success"
  | "history"
type RiskLevel = "low" | "moderate" | "high"
type Gender = "masculino" | "femenino"

// Definir el tipo para SpeechRecognition ya que TypeScript no lo reconoce por defecto
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: (event: SpeechRecognitionEvent) => void
  onerror: (event: SpeechRecognitionErrorEvent) => void
  onend: () => void
}

interface SpeechRecognitionEvent {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  item: (index: number) => SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item: (index: number) => SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface Window {
  SpeechRecognition: new () => SpeechRecognition
  webkitSpeechRecognition: new () => SpeechRecognition
  webkitSpeechRecognition: new () => SpeechRecognition
}

export default function MiSaludIA() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("welcome")
  const [isRecording, setIsRecording] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [showChat, setShowChat] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [userSymptoms, setUserSymptoms] = useState(
    "Tengo dolor de cabeza desde esta mañana y me siento muy cansado. También tengo un poco de fiebre.",
  )
  const [isEditingSymptoms, setIsEditingSymptoms] = useState(false)
  const [editedSymptoms, setEditedSymptoms] = useState("")
  const [transcription, setTranscription] = useState("")

  // Demographics state
  const [age, setAge] = useState(25)
  const [gender, setGender] = useState<Gender | "">("")
  const [hasConditions, setHasConditions] = useState<boolean | null>(null)
  const [medicalConditions, setMedicalConditions] = useState("")
  const [isRecordingConditions, setIsRecordingConditions] = useState(false)

  const [isEditingAge, setIsEditingAge] = useState(false)
  const [isEditingGender, setIsEditingGender] = useState(false)
  const [editedAge, setEditedAge] = useState(25)
  const [editedGender, setEditedGender] = useState<Gender | "">("")

  // Audio state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  // Progressive disclosure
  const [showAdditionalSymptoms, setShowAdditionalSymptoms] = useState(false)
  const [additionalSymptoms, setAdditionalSymptoms] = useState("")

  // Age input ref for focus management
  const ageInputRef = useRef<HTMLInputElement>(null)

  // Modal states
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [showQuickGuideModal, setShowQuickGuideModal] = useState(false)
  const [showReferencesModal, setShowReferencesModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showGoBackConfirmation, setShowGoBackConfirmation] = useState(false)

  // Symptom suggestions
  const symptomSuggestions = [
    "Dolor de cabeza",
    "Fiebre",
    "Me siento ansioso",
    "Dolor de garganta",
    "Tos",
    "Fatiga",
    "Náuseas",
    "Dolor abdominal",
    "Mareos",
    "Dificultad para respirar",
  ]

  const [expandedProbability, setExpandedProbability] = useState<string | null>(null)

  const [countryCode, setCountryCode] = useState("")

  // Referencia para el reconocimiento de voz
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Token system state
  const [tokens, setTokens] = useState(2)
  const [hasRegistered, setHasRegistered] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [showTokenDropdown, setShowTokenDropdown] = useState(false)

  const [lastSpeechDetected, setLastSpeechDetected] = useState<number>(Date.now())

  // User profile dropdown state
  const [showUserDropdown, setShowUserDropdown] = useState(false)

  // User profile state
  const [showHealthProfileModal, setShowHealthProfileModal] = useState(false)
  const [userEmail, setUserEmail] = useState("usuario@ejemplo.com")
  const [userName, setUserName] = useState("Usuario Ejemplo")
  const [userPhone, setUserPhone] = useState("+52 123 456 7890")
  const [userCountry, setUserCountry] = useState("México")

  // Add new state for country code selection
  const [selectedCountryCode, setSelectedCountryCode] = useState("+1")

  // Add countries array with flags
  const countries = [
    { code: "DO", name: "República Dominicana", flag: "🇩🇴" },
    { code: "MX", name: "México", flag: "🇲🇽" },
    { code: "CO", name: "Colombia", flag: "🇨🇴" },
    { code: "AR", name: "Argentina", flag: "🇦🇷" },
    { code: "PE", name: "Perú", flag: "🇵🇪" },
    { code: "VE", name: "Venezuela", flag: "🇻🇪" },
    { code: "CL", name: "Chile", flag: "🇨🇱" },
    { code: "EC", name: "Ecuador", flag: "🇪🇨" },
    { code: "GT", name: "Guatemala", flag: "🇬🇹" },
    { code: "CU", name: "Cuba", flag: "🇨🇺" },
    { code: "BO", name: "Bolivia", flag: "🇧🇴" },
    { code: "HN", name: "Honduras", flag: "🇭🇳" },
    { code: "PY", name: "Paraguay", flag: "🇵🇾" },
    { code: "SV", name: "El Salvador", flag: "🇸🇻" },
    { code: "NI", name: "Nicaragua", flag: "🇳🇮" },
    { code: "CR", name: "Costa Rica", flag: "🇨🇷" },
    { code: "PA", name: "Panamá", flag: "🇵🇦" },
    { code: "UY", name: "Uruguay", flag: "🇺🇾" },
    { code: "US", name: "Estados Unidos", flag: "🇺🇸" },
    { code: "CA", name: "Canadá", flag: "🇨🇦" },
    { code: "ES", name: "España", flag: "🇪🇸" },
    { code: "FR", name: "Francia", flag: "🇫🇷" },
    { code: "IT", name: "Italia", flag: "🇮🇹" },
    { code: "DE", name: "Alemania", flag: "🇩🇪" },
    { code: "GB", name: "Reino Unido", flag: "🇬🇧" },
  ]

  const [standardizedConditions, setStandardizedConditions] = useState("")
  const [editedConditions, setEditedConditions] = useState("")
  const [isEditingConditions, setIsEditingConditions] = useState(false)
  const [symptomsExpanded, setSymptomsExpanded] = useState(false) // Default to closed

  const phoneCountryCodes = [
    { code: "+1", name: "Estados Unidos", flag: "🇺🇸" },
    { code: "+52", name: "México", flag: "🇲🇽" },
    { code: "+54", name: "Argentina", flag: "🇦🇷" },
    { code: "+57", name: "Colombia", flag: "🇨🇴" },
    { code: "+34", name: "España", flag: "🇪🇸" },
    { code: "+51", name: "Perú", flag: "🇵🇪" },
    { code: "+56", name: "Chile", flag: "🇨🇱" },
    { code: "+593", name: "Ecuador", flag: "🇪🇨" },
    { code: "+502", name: "Guatemala", flag: "🇬🇹" },
    { code: "+506", name: "Costa Rica", flag: "🇨🇷" },
    { code: "+507", name: "Panamá", flag: "🇵🇦" },
    { code: "+598", name: "Uruguay", flag: "🇺🇾" },
    { code: "+58", name: "Venezuela", flag: "🇻🇪" },
    { code: "+591", name: "Bolivia", flag: "🇧🇴" },
    { code: "+504", name: "Honduras", flag: "🇭🇳" },
    { code: "+503", name: "El Salvador", flag: "🇸🇻" },
    { code: "+505", name: "Nicaragua", flag: "🇳🇮" },
    { code: "+595", name: "Paraguay", flag: "🇵🇾" },
    { code: "+1 787", name: "Puerto Rico", flag: "🇵🇷" },
    { code: "+1 809", name: "República Dominicana", flag: "🇩🇴" },
  ]

  const handleStartRecording = () => {
    setCurrentScreen("recording")
    setIsRecording(true)
    setTranscription("")

    // Iniciar reconocimiento de voz
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition()
        const recognition = recognitionRef.current

        recognition.lang = "es-ES"
        recognition.continuous = true
        recognition.interimResults = true

        recognition.onresult = (event) => {
          let finalTranscript = ""
          let interimTranscript = ""

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript
            if (event.results[i].isFinal) {
              finalTranscript += transcript
            } else {
              interimTranscript += transcript
            }
          }

          const currentTranscription = finalTranscript || interimTranscript
          setTranscription(currentTranscription)

          // Actualizar el tiempo de la última detección de voz
          setLastSpeechDetected(Date.now())
        }

        recognition.onerror = (event) => {
          console.error("Error en reconocimiento de voz:", event.error)
          setIsRecording(false)
          alert("Error al capturar audio. Intenta de nuevo o usa la opción de texto.")
        }

        recognition.onend = () => {
          setIsRecording(false)
        }

        try {
          recognition.start()

          // Configurar un intervalo para verificar el silencio
          const silenceCheckInterval = setInterval(() => {
            const now = Date.now()
            const silenceDuration = now - lastSpeechDetected

            // Si han pasado más de 10 segundos sin hablar, detener la grabación
            if (silenceDuration > 10000 && isRecording) {
              clearInterval(silenceCheckInterval)
              handleStopRecording()
            }
          }, 1000) // Verificar cada segundo

          // Limpiar el intervalo cuando se detenga la grabación
          return () => clearInterval(silenceCheckInterval)
        } catch (error) {
          console.error("Error al iniciar reconocimiento:", error)
          alert("No se pudo iniciar el reconocimiento de voz. Usa la opción de texto.")
          setCurrentScreen("welcome")
        }
      } else {
        alert("Tu navegador no soporta reconocimiento de voz. Intenta con Chrome o Edge.")
        setIsRecording(false)
        setCurrentScreen("welcome")
      }
    }
  }

  const handleStopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    setIsRecording(false)

    if (transcription.trim()) {
      setUserSymptoms(transcription)
      setCurrentScreen("demographics-age")
    } else {
      // Si no hay transcripción, usar un texto predeterminado o pedir al usuario que intente de nuevo
      alert("No se pudo capturar tu voz. Por favor intenta de nuevo o usa la opción de texto.")
      setCurrentScreen("welcome")
    }
  }

  const handleChatSubmit = () => {
    if (chatInput.trim()) {
      setUserSymptoms(chatInput)
      setShowChat(false)
      setChatInput("")
      setCurrentScreen("demographics-age")
    }
  }

  const handleUpload = () => {
    setShowUpload(false)
    setCurrentScreen("demographics-age")
  }

  const handleAgeSubmit = () => {
    if (age >= 1 && age <= 120) {
      setCurrentScreen("demographics-gender")
    }
  }

  const handleGenderSubmit = () => {
    if (gender) {
      setCurrentScreen("demographics-conditions")
    }
  }

  const handleConditionsSubmit = () => {
    if (tokens > 0) {
      setTokens(tokens - 1)
      setCurrentScreen("confirmation")
      setTimeout(() => {
        setCurrentScreen("response")
      }, 2000)
    } else {
      setCurrentScreen("purchase-tokens")
    }
  }

  const handleStartRecordingConditions = () => {
    setIsRecordingConditions(true)

    // Iniciar reconocimiento de voz para condiciones médicas
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()

        recognition.lang = "es-ES"
        recognition.continuous = false
        recognition.interimResults = false

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript
          setMedicalConditions(transcript)
        }

        recognition.onerror = () => {
          setIsRecordingConditions(false)
          setMedicalConditions("Diabetes tipo 2 diagnosticada hace 5 años, controlada con metformina")
        }

        recognition.onend = () => {
          setIsRecordingConditions(false)
        }

        try {
          recognition.start()
        } catch (error) {
          setIsRecordingConditions(false)
          setMedicalConditions("Diabetes tipo 2 diagnosticada hace 5 años, controlada con metformina")
        }

        // Backup en caso de que el reconocimiento falle
        setTimeout(() => {
          if (isRecordingConditions) {
            recognition.stop()
            setIsRecordingConditions(false)
            setMedicalConditions("Diabetes tipo 2 diagnosticada hace 5 años, controlada con metformina")
          }
        }, 5000)
      } else {
        // Fallback si el navegador no soporta reconocimiento de voz
        setTimeout(() => {
          setIsRecordingConditions(false)
          setMedicalConditions("Diabetes tipo 2 diagnosticada hace 5 años, controlada con metformina")
        }, 3000)
      }
    }
  }

  const handleEditSymptoms = () => {
    setEditedSymptoms(userSymptoms)
    setIsEditingSymptoms(true)
    // Cancel other edits
    setIsEditingAge(false)
    setIsEditingGender(false)
    setIsEditingConditions(false)
  }

  const handleSaveSymptoms = () => {
    if (tokens <= 0) {
      alert("No tienes tokens suficientes para reanalizar. Por favor, compra más.")
      return
    }
    if (editedSymptoms.trim()) {
      setUserSymptoms(editedSymptoms)
      setIsEditingSymptoms(false)
      setTokens((prev) => prev - 1) // Decrement token
      setCurrentScreen("confirmation")
      setTimeout(() => {
        setCurrentScreen("response")
      }, 2000)
    }
  }

  const handleCancelEdit = () => {
    setIsEditingSymptoms(false)
    setEditedSymptoms("")
  }

  const handleEditAge = () => {
    setEditedAge(age)
    setIsEditingAge(true)
    // Cancel other edits
    setIsEditingSymptoms(false)
    setIsEditingGender(false)
    setIsEditingConditions(false)
  }

  const handleSaveAge = () => {
    if (tokens <= 0) {
      alert("No tienes tokens suficientes para reanalizar. Por favor, compra más.")
      return
    }
    if (editedAge >= 1 && editedAge <= 120) {
      setAge(editedAge)
      setIsEditingAge(false)
      setTokens((prev) => prev - 1) // Decrement token
      setCurrentScreen("confirmation")
      setTimeout(() => {
        setCurrentScreen("response")
      }, 2000)
    }
  }

  const handleCancelAgeEdit = () => {
    setIsEditingAge(false)
    setEditedAge(age)
  }

  const handleEditGender = () => {
    setEditedGender(gender)
    setIsEditingGender(true)
    // Cancel other edits
    setIsEditingSymptoms(false)
    setIsEditingAge(false)
    setIsEditingConditions(false)
  }

  const handleSaveGender = () => {
    if (tokens <= 0) {
      alert("No tienes tokens suficientes para reanalizar. Por favor, compra más.")
      return
    }
    if (editedGender) {
      setGender(editedGender)
      setIsEditingGender(false)
      setTokens((prev) => prev - 1) // Decrement token
      setCurrentScreen("confirmation")
      setTimeout(() => {
        setCurrentScreen("response")
      }, 2000)
    }
  }

  const handleCancelGenderEdit = () => {
    setIsEditingGender(false)
    setEditedGender(gender)
  }

  const handlePlayAudio = () => {
    setIsPlayingAudio(true)
    // Simulate audio playback
    setTimeout(() => {
      setIsPlayingAudio(false)
    }, 8000)

    // In a real app, you would use Web Speech API or similar
    if ("speechSynthesis" in window) {
      const text = `Evaluación médica por inteligencia artificial. Subjetivo: ${userSymptoms}. Objetivo: Paciente de ${age} años, sexo ${gender ? getGenderLabel(gender as Gender) : "no especificado"}. Análisis: Los síntomas descritos sugieren un posible cuadro gripal común. Plan: Se recomienda reposo, hidratación y monitoreo de síntomas. Consultar médico si persisten más de 3 días.`

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = "es-MX" // Cambiar a español latinoamericano (México)
      utterance.rate = 0.8
      utterance.onend = () => setIsPlayingAudio(false)

      // Intentar encontrar una voz en español latinoamericano
      const voices = speechSynthesis.getVoices()
      const latinAmericanVoice = voices.find(
        (voice) =>
          voice.lang.includes("es-MX") ||
          voice.lang.includes("es-419") ||
          voice.lang.includes("es-CO") ||
          voice.lang.includes("es-AR"),
      )

      if (latinAmericanVoice) {
        utterance.voice = latinAmericanVoice
      }

      speechSynthesis.speak(utterance)
    }
  }

  const handleStopAudio = () => {
    setIsPlayingAudio(false)
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel()
    }
  }

  const handleSymptomSuggestion = (symptom: string) => {
    if (chatInput.trim()) {
      setChatInput(chatInput + ", " + symptom.toLowerCase())
    } else {
      setChatInput(symptom)
    }
  }

  const findNearbyMedicalCenters = () => {
    // Get user's location and search for nearby medical centers
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          const googleMapsUrl = `https://www.google.com/maps/search/hospital+centro+medico+clinica/@${latitude},${longitude},15z`
          window.open(googleMapsUrl, "_blank")
        },
        (error) => {
          // Fallback: open general medical centers search
          const fallbackUrl = `https://www.google.com/maps/search/hospital+centro+medico+clinica`
          window.open(fallbackUrl, "_blank")
        },
      )
    } else {
      // Fallback for browsers without geolocation
      const fallbackUrl = `https://www.google.com/maps/search/hospital+centro+medico+clinica`
      window.open(fallbackUrl, "_blank")
    }
  }

  const getRiskColor = (risk: RiskLevel) => {
    switch (risk) {
      case "low":
        return "bg-emerald-500"
      case "moderate":
        return "bg-amber-500"
      case "high":
        return "bg-rose-500"
    }
  }

  const getRiskText = (risk: RiskLevel) => {
    switch (risk) {
      case "low":
        return "Riesgo Bajo"
      case "moderate":
        return "Riesgo Moderado"
      case "high":
        return "Riesgo Alto"
    }
  }

  const generateReport = () => {
    const doc = new jsPDF()

    doc.setFontSize(20)
    doc.text("Informe Médico - Mi Salud IA", 10, 10)

    doc.setFontSize(12)
    doc.text(`Síntomas: ${userSymptoms}`, 10, 30)
    doc.text(`Edad: ${age}`, 10, 40)
    doc.text(`Sexo: ${gender ? getGenderLabel(gender as Gender) : "No especificado"}`, 10, 50)
    doc.text(`Condiciones Médicas: ${standardizedConditions || "Ninguna"}`, 10, 60)

    doc.text("Evaluación IA:", 10, 80)
    doc.text("Basado en tus síntomas, la IA sugiere que podrías tener un cuadro gripal común.", 10, 90)
    doc.text("Se recomienda reposo, hidratación y monitoreo de los síntomas.", 10, 100)
    doc.text("Consulta a un médico si persisten por más de 3 días.", 10, 110)

    doc.save("informe_medico.pdf")
  }

  const getGenderLabel = (genderValue: Gender) => {
    switch (genderValue) {
      case "masculino":
        return "Masculino"
      case "femenino":
        return "Femenino"
    }
  }

  // Age manipulation functions
  const incrementAge = () => {
    if (age < 120) {
      setAge(age + 1)
    }
  }

  const decrementAge = () => {
    if (age > 1) {
      setAge(age - 1)
    }
  }

  const handleAgeChange = (value: string) => {
    const numValue = Number.parseInt(value)
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 120) {
      setAge(numValue)
    } else if (value === "") {
      setAge(1)
    }
  }

  // Handle wheel scroll on age input
  const handleAgeWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    if (e.deltaY < 0) {
      incrementAge()
    } else {
      decrementAge()
    }
  }

  // Handle keyboard events for age input
  const handleAgeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault()
      incrementAge()
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      decrementAge()
    } else if (e.key === "Enter") {
      e.preventDefault()
      handleAgeSubmit()
    }
  }

  // Función para estandarizar condiciones
  const standardizeConditions = (conditions: string) => {
    // Simulación de IA para estandarizar
    if (conditions.toLowerCase().includes("diabetes")) {
      return "Diabetes Mellitus Tipo 2"
    }
    if (conditions.toLowerCase().includes("hipertension") || conditions.toLowerCase().includes("presion")) {
      return "Hipertensión Arterial"
    }
    return conditions
  }

  // Usar useEffect para estandarizar cuando cambian las condiciones
  useEffect(() => {
    if (medicalConditions) {
      setStandardizedConditions(standardizeConditions(medicalConditions))
    }
  }, [medicalConditions])

// Dispara el envío a IA en cuanto entramos a la pantalla "confirmation"
useEffect(() => {
  if (currentScreen === "confirmation") {
    handleSubmit()
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentScreen])
  
  
  const handlePurchaseTokens = (tokensToPurchase: number, price: number) => {
    setIsProcessingPayment(true)
    setCurrentScreen("payment-processing")

    // Simular el procesamiento del pago
    setTimeout(() => {
      setIsProcessingPayment(false)
      setTokens(tokens + tokensToPurchase)
      setCurrentScreen("payment-success")
    }, 3000)
  }

  const handleNewAnalysis = () => {
    // Reset all relevant states to go back to the welcome screen for a new analysis
    setUserSymptoms("Tengo dolor de cabeza desde esta mañana y me siento muy cansado. También tengo un poco de fiebre.")
    setTranscription("")
    setAge(25)
    setGender("")
    setHasConditions(null)
    setMedicalConditions("")
    setStandardizedConditions("")
    setIsEditingSymptoms(false)
    setEditedSymptoms("")
    setIsEditingAge(false)
    setEditedAge(25)
    setIsEditingGender(false)
    setEditedGender("")
    setIsEditingConditions(false)
    setEditedConditions("")
    setExpandedProbability(null)
    setIsPlayingAudio(false)
    setShowChat(false)
    setShowUpload(false)
    setShowAdditionalSymptoms(false)
    setAdditionalSymptoms("")
    setLastSpeechDetected(Date.now())
    setShowTokenDropdown(false)
    setShowUserDropdown(false)
    setShowHealthProfileModal(false)
    setShowAccountModal(false)
    setShowQuickGuideModal(false)
    setShowPrivacyModal(false)
    setShowTermsModal(false)
    setShowReferencesModal(false)
    setCurrentScreen("welcome")
  }

  const handleHeaderBack = () => {
    const analysisScreens: Screen[] = ["demographics-age", "demographics-gender", "demographics-conditions", "response"]
    if (analysisScreens.includes(currentScreen)) {
      setShowGoBackConfirmation(true)
    } else {
      // For other screens, just go back directly
      if (currentScreen === "learn-more") {
        setCurrentScreen("response")
      } else if (currentScreen === "purchase-tokens") {
        setCurrentScreen("welcome")
      } else if (currentScreen === "history") {
        setCurrentScreen("welcome")
      } else {
        setCurrentScreen("welcome")
      }
    }
  }

  const isAnyEditing = isEditingSymptoms || isEditingAge || isEditingGender || isEditingConditions


// --------------------------------------------------------------------
//                     FUNCIÓN handleSubmit (nueva)
// --------------------------------------------------------------------
async function handleSubmit() {
  // 1️⃣ Cambiar a pantalla de carga
  setCurrentScreen("loading")

  // 2️⃣ Llamar a tu backend DeepSeek
  const res = await fetch("/api/deepseek", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symptoms: userSymptoms,
      age,
      sex: gender,
      conditions,
    }),
  })
  const { text } = await res.json()
  setAiResponse(text) // mostrar respuesta IA

  // 3️⃣ Guardar en Supabase + contar tokens
  const { used } = await saveConsultation({
    symptoms: userSymptoms,
    age,
    sex: gender,
    conditions,
    aiText: text,
  })
  if (used > 2) {
    setCurrentScreen("token-limit")
    return // detenemos aquí
  }

  // 4️⃣ Mostrar pantalla de resultado
  setCurrentScreen("response")
}
// --------------------------------------------------------------------
  
  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900`}
    >
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 px-6 py-4 sticky top-0 z-50 dark:bg-slate-900/80 dark:border-slate-700/50">
        <div className="max-w-sm mx-auto flex items-center justify-between">
          {currentScreen !== "welcome" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleHeaderBack}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-full"
            >
              <ArrowLeft className="h-8 w-8 text-slate-600 dark:text-slate-300" />
            </Button>
          )}
          {/* User Profile Dropdown */}
          <div className="flex items-center space-x-2 relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center space-x-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all duration-200"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <Heart className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Mi Salud IA</h1>
              <ChevronDown className={`h-4 w-4 text-slate-600 dark:text-slate-300 transition-transform`} />
            </Button>

            {showUserDropdown && (
              <div className="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-3 z-50 animate-in slide-in-from-top-2 duration-200">
                <div className="px-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-100">Perfil de Usuario</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Gestiona tu cuenta y preferencias</p>
                </div>

                <div className="p-3 space-y-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowUserDropdown(false)
                      setShowHealthProfileModal(true)
                    }}
                    className="w-full justify-start px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg"
                  >
                    <User className="h-4 w-4 mr-3" />
                    Perfil de Salud
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowUserDropdown(false)
                      setCurrentScreen("purchase-tokens")
                    }}
                    className="w-full justify-start px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg"
                  >
                    <Droplet className="h-4 w-4 mr-3" />
                    Gestionar Tokens
                  </Button>

                  <div className="border-t border-slate-200 dark:border-slate-700 my-2"></div>

                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowUserDropdown(false)
                      alert("Sesión cerrada")
                    }}
                    className="w-full justify-start px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <LogIn className="h-4 w-4 mr-3" />
                    Cerrar Sesión
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {/* Token Counter with Dropdown */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTokenDropdown(!showTokenDropdown)}
                className="flex items-center space-x-1 bg-blue-50 hover:bg-blue-100 rounded-full px-3 py-1.5 transition-all duration-200"
              >
                <Droplet className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">{tokens}</span>
                <ChevronDown
                  className={`h-3 w-3 text-blue-600 transition-transform ${showTokenDropdown ? "rotate-180" : ""}`}
                />
              </Button>

              {/* Token Dropdown */}
              {showTokenDropdown && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-3 z-50 animate-in slide-in-from-top-2 duration-200">
                  <div className="px-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-100">Análisis disponibles</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Tienes {tokens} análisis restantes</p>
                  </div>

                  <div className="p-3 space-y-3">
                    <h5 className="text-sm font-medium text-slate-700 dark:text-slate-200">Comprar más análisis:</h5>

                    {[
                      { tokens: 3, price: 3, popular: false },
                      { tokens: 10, price: 8, popular: true },
                      { tokens: 30, price: 20, popular: false },
                    ].map((plan, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        onClick={() => {
                          setShowTokenDropdown(false)
                          handlePurchaseTokens(plan.tokens, plan.price)
                        }}
                        className={`w-full justify-between h-auto p-3 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all duration-200 ${
                          plan.popular
                            ? "border-blue-300 dark:border-blue-500 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/50 dark:border-blue-500 dark:text-blue-100 dark:hover:bg-blue-800/60"
                            : ""
                        }`}
                      >
                        <div className="text-left">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-slate-800 dark:text-slate-100">
                              {plan.tokens} análisis
                            </span>
                            {plan.popular && (
                              <Badge className="bg-blue-500 text-white text-xs px-2 py-0.5">Popular</Badge>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            ${(plan.price / plan.tokens).toFixed(2)} por análisis
                          </span>
                        </div>
                        <span className="font-bold text-blue-600">${plan.price}</span>
                      </Button>
                    ))}

                    <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setShowTokenDropdown(false)
                          setCurrentScreen("purchase-tokens")
                        }}
                        className="w-full text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg h-8"
                      >
                        Ver todos los planes →
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="relative group">
              <Button variant="ghost" size="sm" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
                <HelpCircle className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              </Button>

              {/* Menú desplegable de información */}
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowQuickGuideModal(true)}
                  className="w-full justify-start px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  📖 Guía Rápida
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPrivacyModal(true)}
                  className="w-full justify-start px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  🔒 Privacidad
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTermsModal(true)}
                  className="w-full justify-start px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  📋 Términos de Uso
                </Button>
                <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open("mailto:soporte@misaludia.com", "_blank")}
                  className="w-full justify-start px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  📧 Contacto
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-sm mx-auto px-6 py-8">
        {/* Welcome Screen */}
        {currentScreen === "welcome" && (
          <div className="space-y-8">
            {/* Hero Section */}
            <div className="text-center space-y-6">
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/25">
                  <Heart className="h-12 w-12 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 leading-tight">
                  Hola, soy tu
                  <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    asistente médico
                  </span>
                </h2>
                <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed max-w-xs mx-auto">
                  Cuéntame qué sientes y te ayudaré a entender mejor tus síntomas
                </p>
              </div>
            </div>

            {/* Main Action Button */}
            <div className="space-y-4">
              <Button
                onClick={handleStartRecording}
                className="w-full h-20 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-3xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 transform hover:scale-[1.02] border-0"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Mic className="h-7 w-7 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-xl font-semibold">¿Qué sientes?</div>
                    <div className="text-blue-100 text-sm">Toca para hablar</div>
                  </div>
                </div>
              </Button>
            </div>

            {/* Secondary Options */}
            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={() => setShowChat(true)}
                className="w-full h-14 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200"
              >
                <MessageCircle className="h-5 w-5 mr-3 text-slate-500" />
                <span className="font-medium">Escribir mis síntomas</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowAccountModal(true)}
                className="w-full h-10 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 text-sm"
              >
                <LogIn className="h-4 w-4 mr-2 text-slate-400" />
                Crear cuenta (opcional)
              </Button>
              <Button
                variant="ghost"
                onClick={() => setCurrentScreen("history")}
                className="w-full h-10 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 text-sm"
              >
                <History className="h-4 w-4 mr-2 text-slate-400" />
                Historial de análisis
              </Button>
            </div>

            {/* Disclaimer */}
            <Card className="border-amber-200 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-900/20 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                    Esta aplicación es solo educativa y no reemplaza la consulta médica profesional. Si tiene una
                    emergencia, llame al 911 inmediatamente.
                  </p>
                </div>
              </CardContent>
            </Card>
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              Tienes {tokens} análisis gratis al mes.
            </p>
          </div>
        )}

        {/* Recording Screen */}
        {currentScreen === "recording" && (
          <div className="text-center space-y-8 py-16 relative">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Te estoy escuchando</h2>
              <p className="text-slate-600 dark:text-slate-300">Habla con naturalidad sobre cómo te sientes</p>
            </div>

            <div className="relative">
              {/* Hacer que el micrófono sea clickeable para terminar la grabación */}
              <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-lg cursor-pointer hover:scale-105 transition-transform duration-200">
                <Mic className={`h-16 w-16 text-white ${isRecording ? "animate-pulse" : ""}`} />
              </div>
              {isRecording && (
                <>
                  <div className="absolute inset-0 w-32 h-32 border-4 border-blue-300 rounded-full mx-auto animate-ping"></div>
                  <div className="absolute inset-0 w-40 h-40 border-2 border-blue-200 rounded-full mx-auto animate-pulse -m-4"></div>
                </>
              )}
            </div>

            {/* Transcripción en tiempo real */}
            {transcription && (
              <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm p-4 rounded-xl shadow-sm border border-blue-100 max-h-32 overflow-y-auto mx-4">
                <p className="text-sm text-slate-700 dark:text-slate-200 italic leading-relaxed">{transcription}</p>
              </div>
            )}

            {/* Sugerencias con mayor contraste */}
            <div className="space-y-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">Ejemplo:</p>
              <div className="flex justify-center">
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer text-center rounded-2xl">
                  "Me duele la cabeza desde hace 5 días, tengo fatiga y un poco de fiebre..."
                </Badge>
              </div>
            </div>

            {/* Botón más atractivo */}
            <Button
              onClick={handleStopRecording}
              className="w-full max-w-xs mx-auto h-14 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white rounded-2xl px-8 py-3 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] relative z-10 flex items-center justify-center space-x-2"
            >
              <span className="text-lg font-semibold">Realizar Análisis</span>
              <Check className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Demographics Age Screen */}
        {currentScreen === "demographics-age" && (
          <div className="space-y-8 animate-in slide-in-from-right-5 duration-500">
            {/* Header */}
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/25 animate-in zoom-in-50 duration-700">
                <Calendar className="h-10 w-10 text-white" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">¿Cuál es tu edad?</h2>
                <p className="text-slate-600 dark:text-slate-300">Para darte una evaluación más precisa</p>
              </div>
            </div>

            {/* Age Input */}
            <Card className="border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800 animate-in slide-in-from-bottom-3 duration-500 delay-200">
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100">Edad</h3>
                    </div>
                  </div>

                  {/* Age Input with Controls */}
                  <div className="relative">
                    <div className="flex items-center space-x-3">
                      {/* Decrement Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={decrementAge}
                        disabled={age <= 1}
                        className="h-12 w-12 rounded-xl border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      >
                        <ChevronDown className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                      </Button>

                      {/* Age Input */}
                      <div className="flex-1 relative">
                        <Input
                          ref={ageInputRef}
                          type="number"
                          value={age}
                          onChange={(e) => handleAgeChange(e.target.value)}
                          onWheel={handleAgeWheel}
                          onKeyDown={handleAgeKeyDown}
                          className="h-16 text-3xl font-bold text-center border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          min="1"
                          max="120"
                        />
                      </div>

                      {/* Increment Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={incrementAge}
                        disabled={age >= 120}
                        className="h-12 w-12 rounded-xl border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      >
                        <ChevronUp className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Continue Button */}
            <div className="animate-in slide-in-from-bottom-3 duration-500 delay-300">
              <Button
                onClick={handleAgeSubmit}
                disabled={age < 1 || age > 120}
                className={`w-full h-14 rounded-2xl shadow-lg transition-all duration-300 ${
                  age >= 1 && age <= 120
                    ? "bg-gradient-to-r from-blue-400 to-purple-600 hover:from-blue-500 hover:to-purple-700 text-white shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transform hover:scale-[1.02]"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg font-bold text-white drop-shadow-lg">Continuar análisis</span>
                  <ChevronRight className="h-5 w-5 text-white drop-shadow-lg" />
                </div>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentScreen("welcome")}
                className="w-full mt-4 text-slate-500 hover:text-slate-700 dark:hover:bg-slate-600 hover:bg-slate-100 rounded-xl px-3 py-2 text-sm transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Volver
              </Button>
            </div>

            {/* Privacy Note */}
            <Card className="border-blue-200 dark:border-blue-700/50 bg-blue-50/50 dark:bg-blue-900/20 shadow-sm animate-in slide-in-from-bottom-3 duration-500 delay-400">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
                    Tu información personal es privada y segura. Solo se usa para mejorar la precisión del análisis
                    médico.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Demographics Gender Screen */}
        {currentScreen === "demographics-gender" && (
          <div className="space-y-8 animate-in slide-in-from-right-5 duration-500">
            {/* Header */}
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-purple-500/25 animate-in zoom-in-50 duration-700">
                <User className="h-10 w-10 text-white" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">¿Cuál es tu sexo?</h2>
                <p className="text-slate-600 dark:text-slate-300">Para personalizar tu evaluación médica</p>
              </div>
            </div>

            {/* Gender Selection */}
            <Card className="border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800 animate-in slide-in-from-bottom-3 duration-500 delay-200">
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100">Sexo</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300">Selecciona una opción</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { value: "masculino" as Gender, label: "Masculino" },
                      { value: "femenino" as Gender, label: "Femenino" },
                    ].map((option, index) => (
                      <Button
                        key={option.value}
                        variant={gender === option.value ? "default" : "outline"}
                        onClick={() => setGender(option.value)}
                        className={`h-16 rounded-xl transition-all duration-200 animate-in slide-in-from-bottom-2 ${
                          gender === option.value
                            ? "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md"
                            : "border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                        }`}
                        style={{ animationDelay: `${400 + index * 100}ms` }}
                      >
                        <span className="font-medium text-lg">{option.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Continue Button */}
            <div className="animate-in slide-in-from-bottom-3 duration-500 delay-300">
              <Button
                onClick={handleGenderSubmit}
                disabled={!gender}
                className={`w-full h-14 rounded-2xl shadow-lg transition-all duration-300 ${
                  gender
                    ? "bg-gradient-to-r from-blue-400 to-purple-600 hover:from-blue-500 hover:to-purple-700 text-white shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transform hover:scale-[1.02]"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg font-bold text-white drop-shadow-lg">Continuar análisis</span>
                  <ChevronRight className="h-5 w-5 text-white drop-shadow-lg" />
                </div>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentScreen("demographics-age")}
                className="w-full mt-4 text-slate-500 hover:text-slate-700 dark:hover:bg-slate-600 hover:bg-slate-100 rounded-xl px-3 py-2 text-sm transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Volver
              </Button>
            </div>
          </div>
        )}

        {/* Demographics Conditions Screen */}
        {currentScreen === "demographics-conditions" && (
          <div className="space-y-8 animate-in slide-in-from-right-5 duration-500">
            {/* Header */}
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/25 animate-in zoom-in-50 duration-700">
                <Stethoscope className="h-10 w-10 text-white" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  ¿Tienes alguna enfermedad de base?
                </h2>
                <p className="text-slate-600 dark:text-slate-300">Para una evaluación más precisa y segura</p>
              </div>
            </div>

            {/* Yes/No Selection */}
            <Card className="border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800 animate-in slide-in-from-bottom-3 duration-500 delay-200">
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center">
                      <Stethoscope className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100">Enfermedades de base</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300">Selecciona una opción</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { value: true, label: "Sí tengo" },
                      { value: false, label: "No tengo" },
                    ].map((option, index) => (
                      <Button
                        key={option.label}
                        variant={hasConditions === option.value ? "default" : "outline"}
                        onClick={() => setHasConditions(option.value)}
                        className={`h-16 rounded-xl transition-all duration-200 animate-in slide-in-from-bottom-2 ${
                          hasConditions === option.value
                            ? "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md"
                            : "border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                        }`}
                        style={{ animationDelay: `${400 + index * 100}ms` }}
                      >
                        <span className="font-medium text-lg">{option.label}</span>
                      </Button>
                    ))}
                  </div>

                  {/* Conditions Input - Only show if "Yes" is selected */}
                  {hasConditions === true && (
                    <div className="space-y-4 animate-in slide-in-from-bottom-3 duration-300">
                      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                        <h4 className="font-medium text-slate-800 dark:text-slate-100 mb-3">
                          Describe tus enfermedades de base
                        </h4>

                        {/* Recording Button */}
                        <div className="flex space-x-3 mb-3">
                          <Button
                            onClick={handleStartRecordingConditions}
                            variant="outline"
                            className={`flex-1 h-12 border-emerald-200 dark:border-slate-600 text-emerald-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-700 rounded-xl transition-all duration-200 ${
                              isRecordingConditions ? "bg-emerald-100 border-emerald-300" : ""
                            }`}
                            disabled={isRecordingConditions}
                          >
                            <Mic className={`h-5 w-5 mr-2 ${isRecordingConditions ? "animate-pulse" : ""}`} />
                            <span
                              className={`font-medium ${isRecordingConditions ? "text-emerald-800 dark:text-emerald-100" : ""}`}
                            >
                              {isRecordingConditions ? "Escuchando..." : "Cuéntame"}
                            </span>
                          </Button>
                        </div>

                        {/* Text Input */}
                        <Textarea
                          value={medicalConditions}
                          onChange={(e) => setMedicalConditions(e.target.value)}
                          placeholder="Ej: Diabetes tipo 2, hipertensión arterial controlada con medicamentos..."
                          className="min-h-[100px] resize-none border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Continue Button */}
            <div className="animate-in slide-in-from-bottom-3 duration-500 delay-300">
              <Button
                onClick={handleConditionsSubmit}
                disabled={hasConditions === null || (hasConditions === true && !medicalConditions.trim())}
                className={`w-full h-14 rounded-2xl shadow-lg transition-all duration-300 ${
                  hasConditions !== null && (hasConditions === false || medicalConditions.trim())
                    ? "bg-gradient-to-r from-blue-400 to-purple-600 hover:from-blue-500 hover:to-purple-700 text-white shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transform hover:scale-[1.02]"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg font-bold text-white drop-shadow-lg">Continuar análisis</span>
                  <ChevronRight className="h-5 w-5 text-white drop-shadow-lg" />
                </div>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentScreen("demographics-gender")}
                className="w-full mt-4 text-slate-500 hover:text-slate-700 dark:hover:bg-slate-600 hover:bg-slate-100 rounded-xl px-3 py-2 text-sm transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Volver
              </Button>
            </div>

            {/* Info Card */}
            <Card className="border-blue-200 dark:border-blue-700/50 bg-blue-50/50 dark:bg-blue-900/20 shadow-sm animate-in slide-in-from-bottom-3 duration-500 delay-100">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <h3 className="font-semibold text-blue-800 dark:text-blue-300">¿Qué son las enfermedades de base?</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                    Son condiciones médicas crónicas que ya tienes diagnosticadas. Por ejemplo:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {["Diabetes", "Hipertensión", "Asma", "Otros..."].map((condition, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-2 bg-blue-100 dark:bg-blue-800/40 rounded-lg p-2"
                      >
                        <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full"></div>
                        <span className="text-blue-800 dark:text-blue-200 text-xs">{condition}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Privacy Note */}
            <Card className="border-emerald-200 dark:border-emerald-700/50 bg-emerald-50/50 dark:bg-emerald-900/20 shadow-sm animate-in slide-in-from-bottom-3 duration-500 delay-400">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    Tu información médica es completamente confidencial y se usa únicamente para personalizar tu
                    evaluación.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Confirmation Screen */}
        {currentScreen === "confirmation" && (
          <div className="text-center space-y-8 py-16">
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/25">
              <Check className="h-12 w-12 text-white" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">¡Perfecto!</h2>
              <p className="text-slate-600 dark:text-slate-300">Analizando tu información con IA médica</p>
              {age && gender && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Considerando: {age} años, {getGenderLabel(gender as Gender)}
                  {hasConditions === true && medicalConditions && ", con condiciones médicas"}
                </p>
              )}
            </div>
            <div className="flex justify-center">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
              </div>
            </div>
          </div>
        )}

{/* Loading Screen */}
{currentScreen === "loading" && (
  <div className="flex flex-col items-center justify-center py-20 space-y-6">
    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    <p className="text-slate-600 dark:text-slate-300 text-lg">Analizando con IA…</p>
  </div>
)}

        
        {/* AI Response Screen */}
        {currentScreen === "response" && (
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center space-y-2 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-md border border-blue-100">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2">
                Análisis completado <Check className="h-5 w-5 text-emerald-500" />
              </h2>
              <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">
                Aquí tienes mi evaluación educativa
              </p>
            </div>

            {/* User Input Review Card */}
            <Card className="border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setSymptomsExpanded(!symptomsExpanded)}
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-slate-500 to-slate-600 rounded-full flex items-center justify-center">
                        <MessageCircle className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">Tus síntomas</span>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-slate-500 transition-transform ${symptomsExpanded ? "rotate-180" : ""}`}
                    />
                  </div>

                  {symptomsExpanded && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                      <div className="space-y-4">
                        <div className="bg-slate-50 dark:bg-slate-700/60 rounded-xl p-4 relative">
                          <p className="text-slate-700 dark:text-slate-100 leading-relaxed text-sm">{userSymptoms}</p>
                          {!isEditingSymptoms &&
                            !isAnyEditing && ( // Use isAnyEditing here
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleEditSymptoms}
                                className="absolute top-2 right-2 p-1 hover:bg-slate-100 rounded-full"
                                disabled={tokens <= 0}
                              >
                                <Edit3 className="h-4 w-4 text-slate-500" />
                              </Button>
                            )}
                        </div>

                        {isEditingSymptoms ? (
                          <div className="space-y-3">
                            <Textarea
                              value={editedSymptoms}
                              onChange={(e) => setEditedSymptoms(e.target.value)}
                              className="min-h-[100px] resize-none border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Describe tus síntomas..."
                            />
                            <div className="flex space-x-2">
                              <Button
                                onClick={handleSaveSymptoms}
                                className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl h-10"
                                disabled={!editedSymptoms.trim() || tokens <= 0}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Reanalizar
                              </Button>
                              <Button
                                variant="outline"
                                onClick={handleCancelEdit}
                                className="px-4 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl h-10"
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* Demographics inline - Centered */}
                            <div className="flex items-center justify-center bg-slate-50 dark:bg-slate-700/60 rounded-xl p-3">
                              <div className="flex items-center space-x-6">
                                {/* Age */}
                                <div className="flex items-center space-x-2">
                                  {isEditingAge ? (
                                    <div className="flex items-center space-x-2">
                                      <Input
                                        type="number"
                                        value={editedAge}
                                        onChange={(e) => setEditedAge(Number.parseInt(e.target.value) || 1)}
                                        className="h-7 w-16 text-sm border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        min="1"
                                        max="120"
                                      />
                                      <span className="text-slate-600 dark:text-slate-300 text-sm">años</span>
                                      <Button
                                        onClick={handleSaveAge}
                                        size="sm"
                                        className="h-6 px-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded text-xs"
                                        disabled={editedAge < 1 || editedAge > 120 || tokens <= 0}
                                      >
                                        ✓
                                      </Button>
                                      <Button
                                        variant="outline"
                                        onClick={handleCancelAgeEdit}
                                        size="sm"
                                        className="h-6 px-2 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded text-xs"
                                      >
                                        ✕
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center space-x-1">
                                      <span className="text-slate-700 dark:text-slate-200 font-medium text-sm">
                                        {age} años
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleEditAge}
                                        className="p-1 hover:bg-slate-200 rounded-full"
                                        disabled={(isAnyEditing && !isEditingAge) || tokens <= 0} // Update disabled prop
                                      >
                                        <Edit3 className="h-3 w-3 text-slate-500" />
                                      </Button>
                                    </div>
                                  )}
                                </div>

                                {/* Gender */}
                                <div className="flex items-center space-x-2">
                                  {isEditingGender ? (
                                    <div className="flex items-center space-x-2">
                                      <div className="flex space-x-1">
                                        {[
                                          { value: "masculino" as Gender, label: "M" },
                                          { value: "femenino" as Gender, label: "F" },
                                        ].map((option) => (
                                          <Button
                                            key={option.value}
                                            variant={editedGender === option.value ? "default" : "outline"}
                                            onClick={() => setEditedGender(option.value)}
                                            size="sm"
                                            className={`h-6 w-8 rounded text-xs transition-all duration-200 ${
                                              editedGender === option.value
                                                ? "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                                                : "border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                                            }`}
                                          >
                                            {option.label}
                                          </Button>
                                        ))}
                                      </div>
                                      <Button
                                        onClick={handleSaveGender}
                                        size="sm"
                                        className="h-6 px-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded text-xs"
                                        disabled={!editedGender || tokens <= 0}
                                      >
                                        ✓
                                      </Button>
                                      <Button
                                        variant="outline"
                                        onClick={handleCancelGenderEdit}
                                        size="sm"
                                        className="h-6 px-2 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded text-xs"
                                      >
                                        ✕
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center space-x-1">
                                      <span className="text-slate-700 dark:text-slate-200 font-medium text-sm">
                                        {gender ? getGenderLabel(gender as Gender) : "No especificado"}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleEditGender}
                                        className="p-1 hover:bg-slate-200 rounded-full"
                                        disabled={(isAnyEditing && !isEditingGender) || tokens <= 0} // Update disabled prop
                                      >
                                        <Edit3 className="h-3 w-3 text-slate-500" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Medical Conditions - Cuadro separado */}
                            <div className="bg-slate-50 dark:bg-slate-700/60 rounded-xl p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <span className="text-slate-700 dark:text-slate-200 font-medium text-sm">
                                    {hasConditions === true && standardizedConditions
                                      ? `Condiciones: ${standardizedConditions}`
                                      : hasConditions === false
                                        ? "Sin condiciones médicas"
                                        : "Condiciones: No especificada"}
                                  </span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditedConditions(standardizedConditions || "")
                                    setIsEditingConditions(true)
                                  }}
                                  className="p-1 hover:bg-slate-200 rounded-full"
                                  disabled={(isAnyEditing && !isEditingConditions) || tokens <= 0} // Update disabled prop
                                >
                                  <Edit3 className="h-3 w-3 text-slate-500" />
                                </Button>
                              </div>

                              {isEditingConditions && (
                                <div className="mt-2 space-y-2">
                                  <Input
                                    type="text"
                                    value={editedConditions}
                                    onChange={(e) => setEditedConditions(e.target.value)}
                                    className="h-7 text-sm border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Ej: Diabetes, hipertensión..."
                                  />
                                  <div className="flex space-x-2">
                                    <Button
                                      onClick={() => {
                                        if (tokens <= 0) {
                                          alert("No tienes tokens suficientes para reanalizar. Por favor, compra más.")
                                          return
                                        }
                                        if (editedConditions.trim()) {
                                          setStandardizedConditions(standardizeConditions(editedConditions))
                                          setMedicalConditions(editedConditions)
                                          setHasConditions(true)
                                        } else {
                                          setStandardizedConditions("")
                                          setMedicalConditions("")
                                          setHasConditions(false)
                                        }
                                        setIsEditingConditions(false)
                                        setTokens((prev) => prev - 1) // Decrement token
                                        setCurrentScreen("confirmation")
                                        setTimeout(() => setCurrentScreen("response"), 2000)
                                      }}
                                      size="sm"
                                      className="h-6 px-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded text-xs"
                                      disabled={tokens <= 0}
                                    >
                                      Guardar
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => setIsEditingConditions(false)}
                                      size="sm"
                                      className="h-6 px-2 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded text-xs"
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
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

            {/* AI Response Card - Simplified */}
            <Card className="border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
                        <Stethoscope className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">Evaluación IA Médica</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={isPlayingAudio ? handleStopAudio : handlePlayAudio}
                      className="p-2 hover:bg-slate-100 rounded-full"
                    >
                      {isPlayingAudio ? (
                        <VolumeX className="h-4 w-4 text-slate-500" />
                      ) : (
                        <Volume2 className="h-4 w-4 text-slate-500" />
                      )}
                    </Button>
                  </div>

                  {/* Simplified Evaluation */}
                  <div className="space-y-3">
                    <p className="text-slate-700 dark:text-slate-200 leading-relaxed text-sm">
                      Basado en tus síntomas (<span className="font-medium">{userSymptoms}</span>), tu edad (
                      <span className="font-medium">{age} años</span>) y tu sexo (
                      <span className="font-medium">
                        {gender ? getGenderLabel(gender as Gender).toLowerCase() : "no especificado"}
                      </span>
                      ), la IA sugiere que podrías tener un cuadro gripal común. Se recomienda reposo, hidratación y
                      monitoreo de los síntomas. Consulta a un médico si persisten por más de 3 días.
                    </p>

                    {/* Probabilities - Más grandes e interactivas */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">
                        Probabilidades de diagnóstico:
                      </h4>
                      <div className="space-y-3">
                        {[
                          {
                            id: "gripe",
                            name: "Gripe común",
                            percentage: "70%",
                            color: "blue",
                            explanation:
                              "La gripe común es una infección viral que afecta principalmente el sistema respiratorio. Los síntomas incluyen fiebre, dolor de cabeza, fatiga y dolores musculares. Generalmente se resuelve en 7-10 días con reposo y cuidados básicos.",
                          },
                          {
                            id: "resfriado",
                            name: "Resfriado común",
                            percentage: "20%",
                            color: "green",
                            explanation:
                              "El resfriado común es una infección viral leve del tracto respiratorio superior. Los síntomas son más suaves que la gripe e incluyen congestión nasal, estornudos y dolor de garganta leve. Se resuelve en 3-7 días.",
                          },
                          {
                            id: "sinusitis",
                            name: "Sinusitis",
                            percentage: "10%",
                            color: "purple",
                            explanation:
                              "La sinusitis es la inflamación de los senos paranasales. Puede causar dolor facial, congestión nasal y secreción. Puede ser viral o bacteriana y requiere evaluación médica si persiste más de 10 días.",
                          },
                        ].map((prob) => (
                          <div key={prob.id} className="space-y-2">
                            <div
                              className={`flex items-center justify-between p-3 bg-${prob.color}-50 rounded-xl border border-${prob.color}-200 hover:bg-${prob.color}-100 transition-colors cursor-pointer`}
                              onClick={() => setExpandedProbability(expandedProbability === prob.id ? null : prob.id)}
                            >
                              <div className="flex items-center space-x-3">
                                <div className={`w-3 h-3 bg-${prob.color}-500 rounded-full`}></div>
                                <span className={`font-medium text-${prob.color}-800`}>{prob.name}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`text-2xl font-bold text-${prob.color}-600`}>{prob.percentage}</span>
                                <ChevronDown
                                  className={`h-4 w-4 text-${prob.color}-600 transition-transform ${expandedProbability === prob.id ? "rotate-180" : ""}`}
                                />
                              </div>
                            </div>

                            {expandedProbability === prob.id && (
                              <div
                                className={`bg-${prob.color}-25 dark:bg-${prob.color}-900/30 rounded-lg p-4 border border-${prob.color}-100 dark:border-${prob.color}-700 animate-in slide-in-from-top-2 duration-300`}
                              >
                                <p
                                  className={`text-sm text-${prob.color}-800 dark:text-${prob.color}-200 leading-relaxed`}
                                >
                                  {prob.explanation}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Medical Centers Finder */}
            <Card className="border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-red-600" />
                    </div>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">Busca atención médica</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Si necesitas consultar con un profesional, encuentra centros médicos cercanos a tu ubicación
                  </p>
                  <Button
                    onClick={findNearbyMedicalCenters}
                    variant="outline"
                    className="w-full border-red-200 dark:border-slate-600 text-red-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-slate-700 rounded-xl h-12 transition-all duration-200"
                  >
                    <MapPin className="h-5 w-5 mr-3" />
                    <span className="font-medium">Buscar centros médicos</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="lucide lucide-external-link h-4 w-4 ml-2"
                    >
                      <path d="M15 3h6v6" />
                      <path d="M10 14 21 3" />
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    </svg>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* New Analysis Button - Separate Card */}
            <Card className="border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
              <CardContent className="p-6">
                <Button
                  onClick={handleNewAnalysis}
                  variant="default"
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl h-12"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  <span className="font-medium">Hacer otro análisis</span>
                </Button>
              </CardContent>
            </Card>

            {/* Disclaimer */}
            <Card className="border-amber-200 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-900/20 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                    Esta aplicación es solo educativa y no reemplaza la consulta médica profesional. Si tiene una
                    emergencia, llame al 911 inmediatamente.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Token Limit Screen */}
        {currentScreen === "token-limit" && (
          <div className="space-y-8 py-16 text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-red-500/25">
              <X className="h-12 w-12 text-white" />
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">¡Lo sentimos!</h2>
              <p className="text-slate-600 dark:text-slate-300">Has agotado tus análisis gratuitos.</p>
            </div>
            <div className="space-y-4">
              <Button
                onClick={() => setCurrentScreen("purchase-tokens")}
                className="w-full h-14 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 transform hover:scale-[1.02]"
              >
                Comprar más análisis
              </Button>
              {!hasRegistered && (
                <Button
                  variant="outline"
                  onClick={() => setHasRegistered(true)}
                  className="w-full h-14 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200"
                >
                  Registrarme para más análisis gratis
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Purchase Tokens Screen */}
        {currentScreen === "purchase-tokens" && (
          <div className="space-y-6 py-6">
            {/* Back Button */}
            <div className="flex justify-start animate-in slide-in-from-left-3 duration-500">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentScreen("welcome")}
                className="text-slate-500 hover:text-slate-700 dark:hover:bg-slate-600 hover:bg-slate-100 rounded-xl px-3 py-2 text-sm transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Volver
              </Button>
            </div>

            {/* Header */}
            <div className="text-center space-y-6 animate-in fade-in duration-700">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/25">
                  <CreditCard className="h-10 w-10 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Planes de análisis</h2>
                <p className="text-slate-600 dark:text-slate-300 max-w-xs mx-auto leading-relaxed">
                  Elige el plan perfecto para tus necesidades de salud
                </p>
              </div>
            </div>

            {/* Plans Grid */}
            <div className="space-y-4">
              {[
                {
                  tokens: 3,
                  price: 3,
                  popular: false,
                  description: "Perfecto para uso ocasional",
                  pricePerToken: 1.0,
                  savings: null,
                  features: ["3 análisis completos", "Reportes PDF", "Soporte básico"],
                },
                {
                  tokens: 10,
                  price: 8,
                  popular: true,
                  description: "Ideal para uso regular",
                  pricePerToken: 0.8,
                  savings: "20% de descuento",
                  features: ["10 análisis completos", "Reportes PDF", "Soporte prioritario", "Seguimiento automático"],
                },
                {
                  tokens: 30,
                  price: 20,
                  popular: false,
                  description: "Máximo valor para familias",
                  pricePerToken: 0.67,
                  savings: "33% de descuento",
                  features: [
                    "30 análisis completos",
                    "Reportes PDF",
                    "Soporte VIP",
                    "Seguimiento automático",
                    "Consultas ilimitadas",
                  ],
                },
              ].map((plan, index) => (
                <Card
                  key={index}
                  className={`border-2 shadow-sm bg-white dark:bg-slate-800 animate-in slide-in-from-bottom-3 duration-500 transition-all hover:shadow-lg hover:scale-[1.02] ${
                    plan.popular
                      ? "border-blue-300 dark:border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/40 shadow-blue-100 dark:shadow-blue-900/30 ring-2 ring-blue-200 dark:ring-blue-500"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                  style={{ animationDelay: `${200 + index * 100}ms` }}
                >
                  <CardContent className="p-6">
                    {/* Popular Badge */}
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 text-white px-4 py-1 rounded-full shadow-lg">
                          ⭐ Más Popular
                        </Badge>
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Header */}
                      <div className="text-center space-y-2">
                        <div className="flex items-center justify-center space-x-2">
                          <Droplet className={`h-6 w-6 ${plan.popular ? "text-blue-600" : "text-slate-600"}`} />
                          <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">{plan.tokens}</span>
                          <span className="text-slate-600 dark:text-slate-300 font-medium">análisis</span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{plan.description}</p>
                      </div>

                      {/* Price */}
                      <div className="text-center space-y-1">
                        <div className="flex items-center justify-center space-x-2">
                          <span className="text-4xl font-bold text-slate-800 dark:text-slate-100">${plan.price}</span>
                          <div className="text-left">
                            <div className="text-xs text-slate-500 dark:text-slate-400">USD</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              ${plan.pricePerToken.toFixed(2)}/análisis
                            </div>
                          </div>
                        </div>
                        {plan.savings && (
                          <div className="inline-flex items-center space-x-1 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-medium">
                            <span>💰</span>
                            <span>{plan.savings}</span>
                          </div>
                        )}
                      </div>

                      {/* Features */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 text-center">
                          Incluye:
                        </h4>
                        <ul className="space-y-1">
                          {plan.features.map((feature, featureIndex) => (
                            <li
                              key={featureIndex}
                              className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-300"
                            >
                              <div
                                className={`w-1.5 h-1.5 rounded-full ${plan.popular ? "bg-blue-500" : "bg-emerald-500"}`}
                              ></div>
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* CTA Button */}
                      <Button
                        onClick={() => {
                          handlePurchaseTokens(plan.tokens, plan.price)
                        }}
                        className={`w-full h-12 rounded-xl font-semibold transition-all duration-200 ${
                          plan.popular
                            ? "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                            : "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"
                        }`}
                      >
                        {plan.popular ? "🚀 Elegir plan" : "Seleccionar"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Trust Indicators */}
            <div className="space-y-4">
              {/* Security Note */}
              <Card className="border-emerald-200 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/20 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Shield className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-emerald-800">🔒 Pago 100% seguro</p>
                      <p className="text-xs text-emerald-700 leading-relaxed">
                        Procesado con encriptación de grado bancario. Tus datos están completamente protegidos.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Money Back Guarantee */}
            </div>

            {/* FAQ Section */}
            <Card className="border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 shadow-sm">
              <CardContent className="p-5">
                <div className="space-y-4">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-center">
                    ❓ Preguntas frecuentes
                  </h4>
                  <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
                      <span className="font-medium text-slate-700 dark:text-slate-200">¿Los análisis expiran?</span>
                      <p className="mt-1">
                        No, tus análisis no tienen fecha de vencimiento. Úsalos cuando los necesites.
                      </p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        ¿Puedo compartir mis análisis?
                      </span>
                      <p className="mt-1">
                        Los análisis están vinculados a tu cuenta personal por seguridad y privacidad.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Payment Processing Screen */}
        {currentScreen === "payment-processing" && (
          <div className="text-center space-y-8 py-16">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-blue-500/25 animate-spin">
              <Loader2 className="h-12 w-12 text-white" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Procesando pago</h2>
              <p className="text-slate-600 dark:text-slate-300">Estamos validando tu información...</p>
            </div>
          </div>
        )}

        {/* Payment Success Screen */}
        {currentScreen === "payment-success" && (
          <div className="text-center space-y-8 py-16">
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/25">
              <Check className="h-12 w-12 text-white" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">¡Pago exitoso!</h2>
              <p className="text-slate-600 dark:text-slate-300">Ahora tienes {tokens} análisis disponibles.</p>
            </div>
            <Button
              onClick={() => setCurrentScreen("welcome")}
              className="w-full h-14 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 transform hover:scale-[1.02]"
            >
              Volver al inicio
            </Button>
          </div>
        )}

        {/* History Screen */}
        {currentScreen === "history" && (
          <div className="space-y-6 py-6">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-purple-500/25">
                <History className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Historial de Análisis</h2>
              <p className="text-slate-600 dark:text-slate-300">Tus consultas médicas previas</p>
            </div>

            <Card className="border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-3">
                  <div className="bg-slate-50 dark:bg-slate-700/60 rounded-xl p-4">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-100">Consulta del 15/05/2025</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">
                      Síntomas: Dolor de cabeza, fatiga, fiebre leve.
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      Diagnóstico sugerido: Gripe común (70%)
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/60 rounded-xl p-4">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-100">Consulta del 01/05/2025</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">
                      Síntomas: Congestión nasal, estornudos, dolor de garganta.
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      Diagnóstico sugerido: Resfriado común (85%)
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/60 rounded-xl p-4">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-100">Consulta del 20/04/2025</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">
                      Síntomas: Dolor abdominal, náuseas.
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      Diagnóstico sugerido: Indigestión (60%)
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setCurrentScreen("welcome")}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl h-10"
                >
                  Volver al inicio
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Chat Modal */}
      {showChat && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-end z-50">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm mx-auto rounded-t-3xl p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Describe tus síntomas</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowChat(false)}
                className="p-2 hover:bg-slate-100 rounded-full"
              >
                <X className="h-5 w-5 text-slate-500" />
              </Button>
            </div>

            <Textarea
              placeholder="Ej: Tengo dolor de cabeza desde esta mañana y me siento cansado..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="min-h-[120px] resize-none border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            {/* Symptom Suggestions */}
            {chatInput.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-slate-600 dark:text-slate-300">Sugerencias rápidas:</p>
                <div className="flex flex-wrap gap-2">
                  {symptomSuggestions.slice(0, 6).map((symptom, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSymptomSuggestion(symptom)}
                      className="text-xs border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full px-3 py-1 h-auto"
                    >
                      {symptom}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleChatSubmit}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl h-12"
              disabled={!chatInput.trim()}
            >
              Analizar síntomas
            </Button>
          </div>
        </div>
      )}

      {/* Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md mx-auto rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Crear Cuenta</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAccountModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full"
              >
                <X className="h-5 w-5 text-slate-500" />
              </Button>
            </div>

            <div className="space-y-4">
              <Button
                className="w-full h-12 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center"
                onClick={() => alert("Sign in with Google")}
              >
                <div className="mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M12.24 15.53h0c-2.59 0-4.7-2.11-4.7-4.7 0-2.59 2.11-4.7 4.7-4.7h0a4.7 4.7 0 0 1 4.7 4.7c0 2.59-2.11 4.7-4.7 4.7zM7.91 15.72c-1.13.93-2.75 1.57-4.59 1.57 0 0-1.83-.15-3.34-.31v0c-.08 0-.16 0-.24 0 0 .44 0 .87 0 1.3 1.51.16 3.34.31 3.34.31 1.84 0 3.46-.64 4.59-1.57zM16.09 8.28c1.13-.93 2.75-1.57 4.59-1.57 0 0 1.83.15 3.34.31v0c.08 0 .16 0 .24 0 0 .44 0 .87 0 1.3-1.51-.16-3.34-.31-3.34-.31-1.84 0-3.46.64-4.59 1.57zM12.24 24c-6.62 0-12-5.38-12-12s5.38-12 12-12a11.96 11.96 0 0 1 8.49 3.47l-3.47 3.47a8.2 8.2 0 0 0-5.02-1.94c-4.51 0-8.2 3.69-8.2 8.2s3.69 8.2 8.2 8.2c3.09 0 5.84-1.94 7.17-4.77l-7.17-4.77v0h0z" />
                  </svg>
                </div>
                Continuar con Google
              </Button>
              <Button
                className="w-full h-12 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center"
                onClick={() => alert("Sign in with Email")}
              >
                Continuar con Email
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* References Modal */}
      {showReferencesModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md mx-auto rounded-3xl p-6 space-y-6 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Referencias Clínicas</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReferencesModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full"
              >
                <X className="h-5 w-5 text-slate-500" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-800 dark:text-slate-100">Fuentes Médicas Consultadas</h4>

                <div className="space-y-3">
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <h5 className="font-medium text-blue-800 mb-1">CDC (2024)</h5>
                    <p className="text-sm text-blue-700">
                      Manejo ambulatorio de cuadros gripales - Guías de práctica clínica para atención primaria
                    </p>
                  </div>

                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <h5 className="font-medium text-green-800 mb-1">WHO (2024)</h5>
                    <p className="text-sm text-green-700">
                      Algoritmos de triaje comunitario para infecciones respiratorias agudas
                    </p>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                    <h5 className="font-medium text-purple-800 mb-1">MSD Manual (2024)</h5>
                    <p className="text-sm text-purple-700">Diagnóstico diferencial de síndrome gripal en adultos</p>
                  </div>

                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <h5 className="font-medium text-amber-800 mb-1">Medline Plus (2024)</h5>
                    <p className="text-sm text-amber-700">
                      Información actualizada sobre influenza y tratamiento sintomático
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <h5 className="font-medium text-slate-800 dark:text-slate-100 mb-1">UpToDate (2024)</h5>
                    <p className="text-sm text-slate-700">Evaluación clínica de infecciones respiratorias superiores</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <h5 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Metodología de IA</h5>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Nuestro modelo de IA ha sido entrenado con literatura médica revisada por pares, guías clínicas
                  internacionales y bases de datos médicas actualizadas para proporcionar información educativa precisa
                  y actualizada.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => setShowReferencesModal(false)}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl h-10"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Guide Modal */}
      {showQuickGuideModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md mx-auto rounded-3xl p-6 space-y-6 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Guía Rápida</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowQuickGuideModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full"
              >
                <X className="h-5 w-5 text-slate-500" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                  <Heart className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100">¿Qué es Mi Salud IA?</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Tu asistente médico educativo impulsado por inteligencia artificial
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h5 className="font-semibold text-blue-800 mb-2">🎯 Propósito</h5>
                  <p className="text-sm text-blue-700">
                    Ayudarte a entender mejor tus síntomas mediante análisis educativo con IA, proporcionando
                    información médica confiable y recomendaciones básicas.
                  </p>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <h5 className="font-semibold text-green-800 mb-2">🔍 Cómo Funciona</h5>
                  <div className="text-sm text-green-700 space-y-2">
                    <p>
                      <strong>1.</strong> Describe tus síntomas (voz o texto)
                    </p>
                    <p>
                      <strong>2.</strong> Proporciona tu edad y sexo
                    </p>
                    <p>
                      <strong>3.</strong> Recibe análisis personalizado
                    </p>
                    <p>
                      <strong>4.</strong> Aprende más sobre tu condición
                    </p>
                  </div>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <h5 className="font-semibold text-purple-800 mb-2">✨ Características</h5>
                  <div className="text-sm text-purple-700 space-y-1">
                    <p>• Análisis de síntomas con IA</p>
                    <p>• Información médica detallada</p>
                    <p>• Lectura de texto por voz</p>
                    <p>• Búsqueda de centros médicos</p>
                    <p>• Reportes descargables</p>
                  </div>
                </div>

                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <h5 className="font-semibold text-amber-800 mb-2">⚠️ Importante</h5>
                  <p className="text-sm text-amber-700">
                    Esta aplicación es <strong>solo educativa</strong>. No reemplaza la consulta médica profesional. En
                    emergencias, llama al 911.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => setShowQuickGuideModal(false)}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl h-10"
                >
                  ¡Entendido!
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md mx-auto rounded-3xl p-6 space-y-6 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Política de Privacidad</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPrivacyModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full"
              >
                <X className="h-5 w-5 text-slate-500" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h5 className="font-semibold text-blue-800 mb-2">🔒 Protección de Datos</h5>
                  <p className="text-sm text-blue-700">
                    Tu información personal y médica está protegida con encriptación de grado militar. Nunca compartimos
                    tus datos con terceros sin tu consentimiento explícito.
                  </p>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <h5 className="font-semibold text-green-800 mb-2">📊 Uso de la Información</h5>
                  <p className="text-sm text-green-700">Utilizamos tus datos únicamente para:</p>
                  <ul className="text-sm text-green-700 mt-2 space-y-1">
                    <li>• Proporcionar análisis médico personalizado</li>
                    <li>• Mejorar la precisión de nuestros algoritmos</li>
                    <li>• Enviar seguimientos si los solicitas</li>
                  </ul>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <h5 className="font-semibold text-purple-800 mb-2">🗑️ Control de Datos</h5>
                  <p className="text-sm text-purple-700">
                    Tienes derecho a acceder, modificar o eliminar tus datos en cualquier momento.
                  </p>
                </div>

                <div className="bg-amber-50 rounded-lg p-4">
                  <h5 className="font-semibold text-amber-800 mb-2">🍪 Cookies y Seguimiento</h5>
                  <p className="text-sm text-amber-700">
                    Utilizamos cookies esenciales para el funcionamiento de la aplicación. No utilizamos cookies de
                    seguimiento publicitario.
                  </p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <h5 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">📞 Contacto</h5>
                  <p className="text-sm text-slate-700">
                    Para consultas sobre privacidad: <strong>soporte@misaludia.com</strong>
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Última actualización: Enero 2025</p>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => setShowPrivacyModal(false)}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl h-10"
                >
                  Entendido
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Terms Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md mx-auto rounded-3xl p-6 space-y-6 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Términos de Uso</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTermsModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full"
              >
                <X className="h-5 w-5 text-slate-500" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <h5 className="font-semibold text-red-800 mb-2">⚠️ Limitaciones Importantes</h5>
                  <p className="text-sm text-red-700">
                    Mi Salud IA es una herramienta educativa. NO reemplaza el consejo médico profesional. En
                    emergencias, llama al 911 inmediatamente.
                  </p>
                </div>

                <div className="bg-blue-50 rounded-lg p-4">
                  <h5 className="font-semibold text-blue-800 mb-2">🎯 Propósito del Servicio</h5>
                  <p className="text-sm text-blue-700">
                    Proporcionamos información educativa sobre síntomas y condiciones médicas basada en inteligencia
                    artificial entrenada con fuentes médicas confiables.
                  </p>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <h5 className="font-semibold text-green-800 mb-2">👤 Responsabilidades del Usuario</h5>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Proporcionar información precisa y honesta</li>
                    <li>• Consultar profesionales médicos para diagnósticos</li>
                    <li>• No usar la app para emergencias médicas</li>
                    <li>• Mantener la confidencialidad de tu cuenta</li>
                  </ul>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <h5 className="font-semibold text-purple-800 mb-2">🛡️ Limitación de Responsabilidad</h5>
                  <p className="text-sm text-purple-700">
                    No nos hacemos responsables por decisiones médicas tomadas basándose únicamente en nuestras
                    recomendaciones. Siempre consulta un profesional.
                  </p>
                </div>

                <div className="bg-amber-50 rounded-lg p-4">
                  <h5 className="font-semibold text-amber-800 mb-2">📱 Uso Apropiado</h5>
                  <p className="text-sm text-amber-700">
                    Está prohibido usar la aplicación para fines ilegales, compartir información falsa o intentar
                    comprometer la seguridad del sistema.
                  </p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <h5 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">📞 Soporte Legal</h5>
                  <p className="text-sm text-slate-700">
                    Para consultas legales: <strong>soporte@misaludia.com</strong>
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Última actualización: Enero 2025</p>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => setShowTermsModal(false)}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl h-10"
                >
                  Acepto los Términos
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Health Profile Modal */}
      {showHealthProfileModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md mx-auto rounded-3xl p-6 space-y-6 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Perfil de Salud</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHealthProfileModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full"
              >
                <X className="h-5 w-5 text-slate-500" />
              </Button>
            </div>

            <div className="space-y-5">
              <div className="text-center mb-4">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto">
                  <User className="h-10 w-10 text-white" />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Nombre completo
                  </label>
                  <Input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Correo electrónico
                  </label>
                  <Input
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Número telefónico
                  </label>
                  <div className="flex space-x-2">
                    <div className="relative w-40">
                      <select
                        value={selectedCountryCode}
                        onChange={(e) => setSelectedCountryCode(e.target.value)}
                        className="w-full h-12 px-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer text-sm"
                      >
                        {phoneCountryCodes.map((item, index) => (
                          <option key={index} value={item.code}>
                            {item.flag} {item.code}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                    <Input
                      type="tel"
                      value={userPhone.replace(/^\+\d+\s*/, "")}
                      onChange={(e) => {
                        const cleanNumber = e.target.value.replace(/[^\d]/g, "")
                        setUserPhone(selectedCountryCode + " " + cleanNumber)
                      }}
                      placeholder="123 456 7890"
                      className="flex-1 h-12 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">País</label>
                  <div className="relative">
                    <select
                      value={userCountry}
                      onChange={(e) => setUserCountry(e.target.value)}
                      className="w-full h-12 px-4 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
                    >
                      {countries.map((country) => (
                        <option key={country.code} value={country.name}>
                          {country.flag} {country.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setShowHealthProfileModal(false)}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl h-10"
              >
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Go Back Confirmation Modal */}
      {showGoBackConfirmation && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white dark:bg-slate-800 w-full max-w-xs mx-auto rounded-xl p-6 space-y-6 shadow-2xl text-center">
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">¿Estás seguro?</h3>
            <p className="text-slate-600 dark:text-slate-300 text-sm">
              Si vuelves a la pantalla de inicio, perderás el análisis actual. ¿Deseas continuar?
            </p>
            <div className="flex space-x-3">
              <Button
                onClick={() => {
                  setShowGoBackConfirmation(false)
                  handleNewAnalysis() // Resets state and goes to welcome
                }}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg h-10"
              >
                Sí, continuar
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowGoBackConfirmation(false)}
                className="flex-1 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg h-10"
              >
                No, quedarme
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
