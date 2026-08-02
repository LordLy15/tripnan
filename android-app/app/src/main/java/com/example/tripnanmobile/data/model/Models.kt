package com.example.tripnanmobile.data.model

import com.google.gson.annotations.SerializedName

data class Trip(
    val id: String,
    val title: String,
    val destination: String,
    @SerializedName("totalPlanBudget") val planBudget: String,
    @SerializedName("start_date") val startDate: String,
    @SerializedName("end_date") val endDate: String,
    val cover: String?,
    @SerializedName("category_id") val categoryId: String,
    @SerializedName("is_finished") val isFinished: Int
)

data class LoginResponse(
    val success: Boolean,
    val message: String?,
    val full_name: String?,
    val profile_pic: String?
)

data class TripsResponse(
    val success: Boolean,
    val trips: List<Trip>?
)
