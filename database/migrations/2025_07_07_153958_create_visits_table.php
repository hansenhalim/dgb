<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('visits', function (Blueprint $table) {
            $table->uuid('id')->default('uuid_generate_v7()');
            $table->foreignUuid('visitor_id')->nullable()->constrained();
            $table->binary('identity_photo')->nullable();
            $table->string('vehicle_plate_number')->nullable();
            $table->string('purpose_of_visit')->nullable();
            $table->string('destination_name', 30)->nullable();
            $table->timestamp('checkin_at')->nullable();
            $table->timestamp('checkout_at')->nullable();
            $table->timestamps();

            $table->primary('id');
            $table->foreign('destination_name')->references('name')->on('destinations');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('visits');
    }
};
