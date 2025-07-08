<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('rfids', function (Blueprint $table) {
            $table->id();
            $table->binary('uid', 4, true)->unique();
            $table->binary('key', 96, true);
            $table->string('pin')->nullable();
            $table->uuid('rfidable_id')->nullable();
            $table->string('rfidable_type')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rfids');
    }
};
