<x-filament-panels::page>
    <div x-data="rfidEnrollment">
        @if($enrolledUid)
            <x-filament::section>
                <x-slot name="heading">
                    Enrolled RFID Card
                </x-slot>

                <div class="space-y-4">
                    <div>
                        <strong class="text-sm">UID:</strong>
                        <code class="ml-2 rounded bg-gray-100 px-2 py-1 text-sm dark:bg-gray-800">{{ $enrolledUid }}</code>
                    </div>
                    <div>
                        <strong class="text-sm">Key:</strong>
                        <code
                            class="ml-2 rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">{{ Str::limit($enrolledKey, 32) }}...</code>
                    </div>
                </div>
            </x-filament::section>
        @endif

        <form wire:submit="create">

            <div class="mt-6 flex gap-3">
                {{ $this->enrollAction }}

                @if($enrolledUid)
                    <x-filament::button type="submit">
                        Save RFID
                    </x-filament::button>
                @endif
            </div>
        </form>
    </div>

    @script
    <script>
        let port;
        let reader;
        let writer;

        Alpine.data('rfidEnrollment', () => ({
            isEnrolling: false,

            init() {
                Livewire.on('start-rfid-enrollment', async () => {
                    await this.connectAndEnroll();
                });
            },

            async connectAndEnroll() {
                if (this.isEnrolling) {
                    return;
                }

                this.isEnrolling = true;

                try {
                    // Check if Web Serial API is supported
                    if (!('serial' in navigator)) {
                        this.showError('Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.');
                        return;
                    }


                    const usbVendorId = 0x303a;

                    // Request port
                    port = await navigator.serial.requestPort({ filters: [{ usbVendorId }] });

                    // Open port with appropriate settings
                    await port.open({
                        baudRate: 115200,
                        dataBits: 8,
                        stopBits: 1,
                        parity: 'none'
                    });

                    // Get reader and writer
                    const textDecoder = new TextDecoderStream();
                    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
                    reader = textDecoder.readable.getReader();

                    const textEncoder = new TextEncoderStream();
                    const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
                    writer = textEncoder.writable.getWriter();

                    // Show loading notification
                    new FilamentNotification()
                        .title('Waiting for RFID Card')
                        .body('Please present an RFID card to the reader...')
                        .info()
                        .send();

                    // Send enrollment command
                    const enrollCommand = 'ENROLL C0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEE\n';
                    await writer.write(enrollCommand);

                    // Read response
                    let response = '';
                    let timeoutId;

                    const readPromise = new Promise(async (resolve, reject) => {
                        timeoutId = setTimeout(() => {
                            reject(new Error('Timeout waiting for RFID reader response'));
                        }, 30000); // 30 second timeout

                        try {
                            while (true) {
                                const { value, done } = await reader.read();
                                if (done) {
                                    break;
                                }
                                response += value;

                                // Check if we have a complete response
                                if (response.includes('\n') || response.includes('OK') || response.includes('ERROR')) {
                                    clearTimeout(timeoutId);
                                    resolve(response);
                                    break;
                                }
                            }
                        } catch (error) {
                            clearTimeout(timeoutId);
                            reject(error);
                        }
                    });

                    response = await readPromise;

                    // Parse response - expecting format like "OK ENROLL_DONE"
                    if (response.includes('OK ENROLL_DONE')) {
                        // Success - show notification and let Livewire handle the rest
                        new FilamentNotification()
                            .title('RFID Card Enrolled')
                            .body('The RFID card has been successfully enrolled.')
                            .success()
                            .send();

                        // Trigger Livewire to refresh or handle enrollment completion
                        $wire.call('handleEnrollmentComplete');
                    } else {
                        // Try legacy format with UID and KEY
                        const uidMatch = response.match(/UID:([0-9A-Fa-f]+)/);
                        const keyMatch = response.match(/KEY:([0-9A-Fa-f]+)/);

                        if (uidMatch && keyMatch) {
                            const uid = uidMatch[1].toUpperCase();
                            const key = keyMatch[1].toUpperCase();

                            // Send data to Livewire
                            $wire.call('setEnrollmentData', uid, key);
                        } else {
                            this.showError('Failed to parse RFID response: ' + response);
                        }
                    }

                    // Close connection
                    await this.closeConnection();

                } catch (error) {
                    console.error('RFID Enrollment Error:', error);
                    this.showError('Error during RFID enrollment: ' + error.message);
                    await this.closeConnection();
                } finally {
                    this.isEnrolling = false;
                }
            },

            async closeConnection() {
                try {
                    if (reader) {
                        await reader.cancel();
                        reader = null;
                    }
                    if (writer) {
                        await writer.close();
                        writer = null;
                    }
                    if (port) {
                        await port.close();
                        port = null;
                    }
                } catch (error) {
                    console.error('Error closing connection:', error);
                }
            },

            showError(message) {
                new FilamentNotification()
                    .title('RFID Enrollment Error')
                    .body(message)
                    .danger()
                    .send();
            }
        }));
    </script>
    @endscript
</x-filament-panels::page>