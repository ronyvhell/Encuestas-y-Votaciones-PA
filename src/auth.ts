import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

import { connectDB } from "@/lib/db"
import { User } from "@/lib/models"

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credenciales",
      credentials: {
        email: { label: "Correo electrónico", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: async (credentials) => {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : ""
        const password = typeof credentials?.password === "string" ? credentials.password : ""

        if (!email || !password) return null

        await connectDB()

        const user = await User.findOne({ email })
        if (!user) return null

        const coincide = await bcrypt.compare(password, user.passwordHash)
        if (!coincide) return null

        return { id: user._id.toString(), name: user.nombre, email: user.email }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (token.id && session.user) session.user.id = token.id as string
      return session
    },
    authorized({ auth }) {
      return !!auth
    },
  },
})
