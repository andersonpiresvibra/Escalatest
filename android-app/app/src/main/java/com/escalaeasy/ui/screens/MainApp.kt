package com.escalaeasy.ui.screens

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController

@Composable
fun MainApp() {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = "dashboard") {
        composable("dashboard") {
            DashboardScreen(
                onNavigateToLogin = { navController.navigate("login") }
            )
        }
        composable("login") {
            LoginScreen(
                onLoginSuccess = { navController.navigate("dashboard") { popUpTo(0) } }
            )
        }
    }
}
