package com.example.tripnanmobile.data.network

import com.example.tripnanmobile.data.model.LoginResponse
import com.example.tripnanmobile.data.model.TripsResponse
import retrofit2.Response
import retrofit2.http.Field
import retrofit2.http.FormUrlEncoded
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

interface TripApiService {
    @FormUrlEncoded
    @POST("api/api.php")
    suspend fun login(
        @Field("action") action: String = "login",
        @Field("username") username: String,
        @Field("password") password: String
    ): Response<LoginResponse>

    @GET("api/api.php")
    suspend fun getTrips(
        @Query("action") action: String = "get_trips",
        @Query("owner") owner: String
    ): Response<TripsResponse>
}
