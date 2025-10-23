<x-filament-panels::page>
    <div x-data="rfidEnrollment">
        @if($lastEnrolledCard)
            <x-filament::section>
                <x-slot name="heading">
                    <div class="flex items-center justify-between">
                        <span>Last Enrolled Card</span>
                        <span class="text-xs font-normal text-gray-500 dark:text-gray-400">
                            {{ $lastEnrolledCard['enrolled_at'] }}
                        </span>
                    </div>
                </x-slot>

                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                    <!-- Numeric UID - Large and prominent -->
                    <div style="background-color: #dcfce7; border-radius: 0.75rem; padding: 2rem;">
                        <div style="font-size: 0.875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #15803d; margin-bottom: 1rem;">
                            NUMERIC UID
                        </div>
                        <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 3.75rem; font-weight: 900; line-height: 1.2; letter-spacing: 0.05em; color: #14532d;">
                            {{ $lastEnrolledCard['uid_numeric'] }}
                        </div>
                    </div>

                    <!-- Hex UID - Secondary display -->
                    <div>
                        <div style="font-size: 0.875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #4b5563; margin-bottom: 0.75rem;">
                            HEX UID
                        </div>
                        <code style="display: block; background-color: #e5e7eb; border-radius: 0.75rem; padding: 1rem 1.25rem; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1.25rem; font-weight: 700; letter-spacing: 0.1em; color: #111827;">{{ $lastEnrolledCard['uid'] }}</code>
                    </div>
                </div>
            </x-filament::section>
        @endif

        <div class="mt-6">
            {{ $this->enrollAction }}
        </div>
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

                    // Request port (reuse if already open)
                    if (!port) {
                        port = await navigator.serial.requestPort({ filters: [{ usbVendorId }] });
                    }

                    // Only open if not already open
                    if (!port.readable) {
                        await port.open({
                            baudRate: 115200,
                            dataBits: 8,
                            stopBits: 1,
                            parity: 'none'
                        });
                    }

                    // Get reader and writer (only if not already created)
                    if (!reader || !writer) {
                        const textDecoder = new TextDecoderStream();
                        const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
                        reader = textDecoder.readable.getReader();

                        const textEncoder = new TextEncoderStream();
                        const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
                        writer = textEncoder.writable.getWriter();
                    }

                    // Show loading notification
                    new FilamentNotification()
                        .title('Waiting for RFID Card')
                        .body('Please present an RFID card to the reader...')
                        .info()
                        .send();

                    // First, scan the UID
                    await writer.write('SCAN_UID\n');

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

                    // Parse UID from SCAN_UID response - expecting "OK UID <hex_uid>"
                    const uidMatch = response.match(/OK UID ([0-9A-Fa-f]+)/);

                    if (uidMatch) {
                        const uid = uidMatch[1].toUpperCase();

                        // Show progress
                        new FilamentNotification()
                            .title('Card Detected')
                            .body(`UID: ${uid}. Enrolling card...`)
                            .info()
                            .send();

                        // Now enroll the card with the authentication key
                        const enrollCommand = 'ENROLL C0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEEC0FFEE\n';
                        await writer.write(enrollCommand);

                        // Read enrollment response
                        response = '';
                        const enrollReadPromise = new Promise(async (resolve, reject) => {
                            const enrollTimeoutId = setTimeout(() => {
                                reject(new Error('Timeout waiting for enrollment response'));
                            }, 30000); // 30 second timeout

                            try {
                                while (true) {
                                    const { value, done } = await reader.read();
                                    if (done) {
                                        break;
                                    }
                                    response += value;

                                    // Check if we have a complete response
                                    if (response.includes('\n') || response.includes('OK') || response.includes('ERR')) {
                                        clearTimeout(enrollTimeoutId);
                                        resolve(response);
                                        break;
                                    }
                                }
                            } catch (error) {
                                clearTimeout(enrollTimeoutId);
                                reject(error);
                            }
                        });

                        response = await enrollReadPromise;

                        // Check if enrollment succeeded
                        if (response.includes('OK ENROLL_DONE')) {
                            // Send UID to Livewire to save to database
                            $wire.call('handleEnrollmentComplete', uid);
                        } else {
                            this.showError('Enrollment failed: ' + response);
                        }
                    } else if (response.includes('ERR NO_TAG')) {
                        this.showError('No RFID card detected. Please present a card and try again.');
                    } else {
                        this.showError('Failed to scan RFID card: ' + response);
                    }

                    // Don't close connection - keep it open for next enrollment

                } catch (error) {
                    console.error('RFID Enrollment Error:', error);
                    this.showError('Error during RFID enrollment: ' + error.message);
                    // On error, close everything
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
            },
        }));
    </script>
    @endscript
</x-filament-panels::page>