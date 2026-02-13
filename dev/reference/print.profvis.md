# Print a profvis object

Print a profvis object

## Usage

``` r
# S3 method for class 'profvis'
print(x, ..., width = NULL, height = NULL, split = NULL, aggregate = NULL)
```

## Arguments

- x:

  The object to print.

- ...:

  Further arguments to passed on to other print methods.

- width:

  Width of the htmlwidget.

- height:

  Height of the htmlwidget

- split:

  Orientation of the split bar: either `"h"` (the default) for
  horizontal or `"v"` for vertical.

- aggregate:

  If `TRUE`, the profiled stacks are aggregated by name. This makes it
  easier to see the big picture. Set your own global default for this
  argument with `options(profvis.aggregate = )`.
