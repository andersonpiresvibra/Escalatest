package com.escalaeasy.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.escalaeasy.data.models.Colaborador
import com.escalaeasy.ui.theme.Emerald500
import com.escalaeasy.ui.theme.White
import com.escalaeasy.ui.theme.Slate800

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(onNavigateToLogin: () -> Unit) {
    // Fake data for UI preview
    val colaboradores = listOf(
        Colaborador("collab_1", "João Silva", "Operador", "Ativo"),
        Colaborador("collab_2", "Maria Oliveira", "Líder", "Ativo"),
        Colaborador("collab_3", "Carlos Mendes", "Supervisor", "Férias")
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Portal do Colaborador", color = White) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Slate800)
            )
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding).fillMaxSize().padding(16.dp)) {
            Text(
                text = "Minha Escala",
                style = MaterialTheme.typography.titleLarge,
                color = White,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(colaboradores) { collab ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Slate800),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(text = collab.nome, color = White, style = MaterialTheme.typography.bodyLarge)
                            Text(text = "${collab.cargo} - ${collab.status}", color = Emerald500, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }
    }
}
