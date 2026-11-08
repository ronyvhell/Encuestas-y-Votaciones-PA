import mongoose, { Schema, model, models } from "mongoose"

import { TIPOS_PREGUNTA, type TipoPregunta } from "@/lib/constants"

export interface IUser {
  nombre: string
  email: string
  passwordHash: string
  createdAt: Date
}

const userSchema = new Schema<IUser>(
  {
    nombre: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
)

export interface ISurveyType {
  nombre: string
  descripcion?: string
  createdAt: Date
}

const surveyTypeSchema = new Schema<ISurveyType>(
  {
    nombre: { type: String, required: true, unique: true, trim: true },
    descripcion: { type: String, default: "" },
  },
  { timestamps: true }
)

export interface IPregunta {
  _id: mongoose.Types.ObjectId
  texto: string
  tipoPregunta: TipoPregunta
  opciones: string[]
  config: { min?: number; max?: number }
  requerida: boolean
  orden: number
  clave?: string
}

const preguntaSchema = new Schema<IPregunta>(
  {
    texto: { type: String, required: true, trim: true },
    tipoPregunta: { type: String, enum: TIPOS_PREGUNTA.map((t) => t.value), required: true },
    opciones: { type: [String], default: [] },
    config: {
      min: { type: Number, default: null },
      max: { type: Number, default: null },
    },
    requerida: { type: Boolean, default: false },
    orden: { type: Number, default: 0 },
    clave: { type: String },
  },
  { _id: true }
)

export interface IEncuesta {
  titulo: string
  descripcion: string
  imagenPortada: string
  tipos: mongoose.Types.ObjectId[]
  estado: "borrador" | "publicada"
  creador: mongoose.Types.ObjectId
  preguntas: IPregunta[]
  votos: number
  createdAt: Date
  updatedAt: Date
}

const encuestaSchema = new Schema<IEncuesta>(
  {
    titulo: { type: String, required: true, trim: true },
    descripcion: { type: String, default: "" },
    imagenPortada: { type: String, default: "" },
    tipos: [{ type: Schema.Types.ObjectId, ref: "SurveyType" }],
    estado: { type: String, enum: ["borrador", "publicada"], default: "borrador" },
    creador: { type: Schema.Types.ObjectId, ref: "User", required: true },
    preguntas: { type: [preguntaSchema], default: [] },
    votos: { type: Number, default: 0 },
  },
  { timestamps: true }
)

encuestaSchema.index({ titulo: "text", descripcion: "text" })

export interface IRespuesta {
  preguntaId: string
  valor: string | string[] | number | boolean
}

export interface IVoto {
  encuestaId: mongoose.Types.ObjectId
  voterId: string
  ipHash: string
  respuestas: IRespuesta[]
  createdAt: Date
}

const votoSchema = new Schema<IVoto>(
  {
    encuestaId: { type: Schema.Types.ObjectId, ref: "Encuesta", required: true },
    voterId: { type: String, required: true },
    ipHash: { type: String, default: "" },
    respuestas: [
      {
        _id: false,
        preguntaId: { type: String, required: true },
        valor: { type: Schema.Types.Mixed, required: true },
      },
    ],
  },
  { timestamps: true }
)

votoSchema.index({ encuestaId: 1, voterId: 1 }, { unique: true })
votoSchema.index({ encuestaId: 1 })

export interface IModelo {
  encuestaId: mongoose.Types.ObjectId
  creador: mongoose.Types.ObjectId
  version: number
  algoritmo: string
  politica: string
  semilla: number
  kFolds: number
  preguntaObjetivoId: string
  textoObjetivo: string
  claveObjetivo?: string
  totalVotos: number
  nRegistros: number
  nExcluidos: number
  clases: string[]
  clasePositiva: string
  distribucion: Record<string, number>
  exactitud: number
  precision: number
  exhaustividad: number
  f1: number
  macroF1: number
  matriz: Record<string, number>
  porClase: unknown[]
  comparacion: unknown[]
  columnas: unknown[]
  importancias: unknown[]
  reglas: unknown[]
  artefacto: unknown
  createdAt: Date
  updatedAt: Date
}

// Modelo predictivo entrenado desde la app. Se guarda una versión por
// entrenamiento para poder comparar y reentrenar sin perder el anterior.
const modeloSchema = new Schema<IModelo>(
  {
    encuestaId: { type: Schema.Types.ObjectId, ref: "Encuesta", required: true },
    creador: { type: Schema.Types.ObjectId, ref: "User", required: true },
    version: { type: Number, required: true },
    algoritmo: { type: String, required: true },
    politica: { type: String, default: "excluir" },
    semilla: { type: Number, default: 20261012 },
    kFolds: { type: Number, default: 5 },
    preguntaObjetivoId: { type: String, required: true },
    textoObjetivo: { type: String, default: "" },
    claveObjetivo: { type: String },
    totalVotos: { type: Number, default: 0 },
    nRegistros: { type: Number, default: 0 },
    nExcluidos: { type: Number, default: 0 },
    clases: { type: [String], default: [] },
    clasePositiva: { type: String, required: true },
    distribucion: { type: Schema.Types.Mixed, default: {} },
    exactitud: { type: Number, default: 0 },
    precision: { type: Number, default: 0 },
    exhaustividad: { type: Number, default: 0 },
    f1: { type: Number, default: 0 },
    macroF1: { type: Number, default: 0 },
    matriz: { type: Schema.Types.Mixed, default: {} },
    porClase: { type: [Schema.Types.Mixed], default: [] },
    comparacion: { type: [Schema.Types.Mixed], default: [] },
    columnas: { type: [Schema.Types.Mixed], default: [] },
    importancias: { type: [Schema.Types.Mixed], default: [] },
    reglas: { type: [Schema.Types.Mixed], default: [] },
    artefacto: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true, minimize: false }
)

modeloSchema.index({ encuestaId: 1, version: -1 })
modeloSchema.index({ encuestaId: 1, createdAt: -1 })

export const User = models.User ?? model<IUser>("User", userSchema)
export const SurveyType = models.SurveyType ?? model<ISurveyType>("SurveyType", surveyTypeSchema)
export const Encuesta = models.Encuesta ?? model<IEncuesta>("Encuesta", encuestaSchema)
export const Voto = models.Voto ?? model<IVoto>("Voto", votoSchema)
export const Modelo = models.Modelo ?? model<IModelo>("Modelo", modeloSchema)
