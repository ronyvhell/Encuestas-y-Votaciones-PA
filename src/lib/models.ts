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

export const User = models.User ?? model<IUser>("User", userSchema)
export const SurveyType = models.SurveyType ?? model<ISurveyType>("SurveyType", surveyTypeSchema)
export const Encuesta = models.Encuesta ?? model<IEncuesta>("Encuesta", encuestaSchema)
export const Voto = models.Voto ?? model<IVoto>("Voto", votoSchema)
