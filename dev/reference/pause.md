# Pause an R process

This function pauses an R process for some amount of time. It differs
from [`Sys.sleep()`](https://rdrr.io/r/base/Sys.sleep.html) in that time
spent in `pause` will show up in profiler data. Another difference is
that `pause` uses up 100\\ whereas `Sys.sleep` does not.

## Usage

``` r
pause(seconds)
```

## Arguments

- seconds:

  Number of seconds to pause.

## Examples

``` r
# Wait for 0.5 seconds
pause(0.5)
#> NULL
```
