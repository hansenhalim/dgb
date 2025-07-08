<?php

use App\Enum\Status;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('transfer_requests', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->enum('status', Status::values());
            $table->smallInteger('from_gate_id');
            $table->smallInteger('to_gate_id');
            $table->foreignUuid('sender_staff_id')->constrained('staff');
            $table->foreignUuid('recipient_staff_id')->nullable()->constrained('staff');
            $table->smallInteger('amount');
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();

            $table->primary('id');
            $table->foreign('from_gate_id')->references('id')->on('gates');
            $table->foreign('to_gate_id')->references('id')->on('gates');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transfer_requests');
    }
};
