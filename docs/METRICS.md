# Metrics

This application is able to generate certain metrics using [Prometheus](https://prometheus.io/) and you can visualize them in [Grafana](https://grafana.com/) with the following dashboard:

* [scripts/grafana-dashboard.json](scripts/grafana-dashboard.json)

# Metrics Description

## Messages

* **notify_rabbit_ack** Total number of ack by notify channel
* **notify_rabbit_messages** Total number of messages by notify channel

## Nodejs engine

### Active Handles

* **nodejs_active_handles** Number of active libuv handles grouped by handle type (Socket && Server). Every handle type is C++ class name.

* **nodejs_active_handles_total** Total number of active handles.


### % CPU usage

* **process_cpu_user_seconds_total** Total user CPU time spent in seconds.

* **process_cpu_system_seconds_total** Total system CPU time spent in seconds.

* **process_cpu_seconds_total**  Total user and system CPU time spent in seconds.

### Event loop lag

* **nodejs_eventloop_lag_seconds** Lag of event loop in seconds.

### Memory 

#### External Memory

* **nodejs_external_memory_bytes** Node.js external memory size in bytes.

#### Heap size

* **nodejs_heap_size_total_bytes** Process heap size from Node.js in bytes.

* **nodejs_heap_size_used_bytes** Process heap size used from Node.js in bytes.

#### Process Memory

* **process_resident_memory_bytes** Resident memory size in bytes.

* **process_virtual_memory_bytes** Virtual memory size in bytes.

### Heap Space Size

#### Total

* **nodejs_heap_space_size_total_bytes** Process heap space size total from Node.js in bytes.
  * **read_only**
  * **new**
  * **old**
  * **code**
  * **map**
  * **large_object**
  * **code_large_object**
  * **new_large_object**

* **nodejs_heap_space_size_available_bytes** Process heap space size available from Node.js in bytes.
  * **read_only**
  * **new**
  * **old**
  * **code**
  * **map**
  * **large_object**
  * **code_large_object**
  * **new_large_object**

* **nodejs_heap_space_size_used_bytes** Process heap space size used from Node.js in bytes.
  * **read_only**
  * **new**
  * **old**
  * **code**
  * **map**
  * **large_object**
  * **code_large_object**
  * **new_large_object**