/* Copyright 2021 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

/* 
 *  Namespaced methods for providing IMU data
 *  @author Rikard Lindstrom <rlindsrom@google.com>
*/
#include "data_provider.h"
#include <Arduino_LSM9DS1.h> // change to Arduino_LSM6DS3.h for Nano 33 IoT or Uno WiFi Rev 2

namespace data_provider
{

  /************************************************************************
  * "Public" functions
  ************************************************************************/

  bool dataAvailable()
  {
    // Skip magnetometer since it's running a lot slower and always wanted
    return IMU.accelerationAvailable() && IMU.gyroscopeAvailable();
  }

  bool setup()
  {

    if (!IMU.begin())
    {
      Serial.println("Failed to initialized IMU!");
      return false;
    }

    // Experimental, enabling this will capture all readings
    // from the IMU sensors and should be more accurate. However,
    // it slows down the main loop by a lot when enabled.
    
    // IMU.setContinuousMode();

    Serial.println("IMU sample rates: ");
    Serial.print("Accelerometer sample rate = ");
    Serial.println(IMU.accelerationSampleRate());
    Serial.print("Gyroscope sample rate = ");
    Serial.println(IMU.gyroscopeSampleRate());
    Serial.print("Magnetometer sample rate = ");
    Serial.println(IMU.magneticFieldSampleRate());

    return true;
  }
}
