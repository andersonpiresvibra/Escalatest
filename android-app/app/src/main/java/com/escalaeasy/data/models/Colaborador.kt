package com.escalaeasy.data.models

import kotlinx.serialization.Serializable

@Serializable
data class Colaborador(
    val id: String,
    val nome: String,
    val cargo: String,
    val status: String
)
