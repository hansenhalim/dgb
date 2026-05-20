<?php

use App\Enum\CurrentPosition;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('visits', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('uuidv7()'));
            $table->foreignUuid('visitor_id')->nullable()->constrained();
            $table->binary('identity_photo', 512_000)->nullable();
            $table->string('vehicle_plate_number', 20)->nullable();
            $table->string('purpose_of_visit')->nullable();
            $table->string('destination_name', 30)->nullable();
            $table->timestamp('checkin_at')->nullable();
            $table->smallInteger('checkin_gate_id')->nullable();
            $table->timestamp('checkout_at')->nullable();
            $table->smallInteger('checkout_gate_id')->nullable();
            $table->enum('current_position', CurrentPosition::values());
            $table->timestamps();

            $table->primary('id');
            $table->foreign('destination_name')->references('name')->on('destinations');
            $table->foreign('checkin_gate_id')->references('id')->on('gates');
            $table->foreign('checkout_gate_id')->references('id')->on('gates');
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
