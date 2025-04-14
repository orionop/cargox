import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  CircularProgress, 
  Divider, 
  Slider, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Typography,
  Paper,
  Chip,
  Stack,
  Alert,
  TablePagination,
  LinearProgress,
  IconButton
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';

const apiUrl = import.meta.env.VITE_API_URL || '';

const RearrangementPanel = () => {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [rearrangementPlan, setRearrangementPlan] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  // Configuration parameters
  const [priorityThreshold, setPriorityThreshold] = useState(30);
  const [maxMovements, setMaxMovements] = useState(10);
  const [spaceTarget, setSpaceTarget] = useState(15);
  
  // Selected movements to apply
  const [selectedMovements, setSelectedMovements] = useState([]);
  
  // Pagination for disorganized containers
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // Fetch rearrangement recommendations
  const fetchRearrangementPlan = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const response = await fetch(
        `${apiUrl}/api/rearrangement?priority_threshold=${priorityThreshold}&max_movements=${maxMovements}&space_target=${spaceTarget}`
      );
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setRearrangementPlan(data);
      
      // Reset selected movements
      setSelectedMovements([]);
      // Reset pagination
      setPage(0);
    } catch (err) {
      setError(err.message || 'Failed to fetch rearrangement recommendations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // Apply selected movements
  const applyRearrangementPlan = async () => {
    if (selectedMovements.length === 0) {
      setError('Please select at least one movement to apply');
      return;
    }
    
    setApplying(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const response = await fetch(`${apiUrl}/api/rearrangement/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          movement_ids: selectedMovements,
          astronaut_id: 'current-user', // In a real app, this would be the logged-in user
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setSuccessMessage(`Successfully applied ${selectedMovements.length} movement(s)`);
        // Refresh the plan with updated data
        fetchRearrangementPlan();
      } else {
        setError(result.message || 'Failed to apply movements');
      }
    } catch (err) {
      setError(err.message || 'Failed to apply movements');
      console.error(err);
    } finally {
      setApplying(false);
    }
  };
  
  // Toggle selection of a movement
  const toggleMovementSelection = (itemId) => {
    if (selectedMovements.includes(itemId)) {
      setSelectedMovements(selectedMovements.filter(id => id !== itemId));
    } else {
      setSelectedMovements([...selectedMovements, itemId]);
    }
  };
  
  // Format time (minutes) as hours and minutes
  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };
  
  // Handle pagination changes
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // Get efficiency color based on score
  const getEfficiencyColor = (score) => {
    if (score < 40) return 'error.main';
    if (score < 70) return 'warning.main';
    return 'success.main';
  };
  
  // Get utilization severity
  const getUtilizationSeverity = (utilization) => {
    if (utilization < 20 || utilization > 90) return 'error';
    if (utilization < 40 || utilization > 80) return 'warning';
    return 'success';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Space Optimization & Rearrangement
      </Typography>
      
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Configuration
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            <Typography gutterBottom>
              Priority Threshold: {priorityThreshold}
              <Typography variant="caption" sx={{ ml: 1 }}>
                (Only move items with priority below this value)
              </Typography>
            </Typography>
            <Slider
              value={priorityThreshold}
              onChange={(_, newValue) => setPriorityThreshold(newValue)}
              min={0}
              max={100}
              valueLabelDisplay="auto"
            />
          </Box>
          
          <Box sx={{ mb: 2 }}>
            <Typography gutterBottom>
              Max Movements: {maxMovements}
            </Typography>
            <Slider
              value={maxMovements}
              onChange={(_, newValue) => setMaxMovements(newValue)}
              min={1}
              max={50}
              valueLabelDisplay="auto"
            />
          </Box>
          
          <Box sx={{ mb: 2 }}>
            <Typography gutterBottom>
              Space Optimization Target: {spaceTarget}%
            </Typography>
            <Slider
              value={spaceTarget}
              onChange={(_, newValue) => setSpaceTarget(newValue)}
              min={5}
              max={50}
              valueLabelDisplay="auto"
            />
          </Box>
          
          <Button
            variant="contained"
            color="primary"
            onClick={fetchRearrangementPlan}
            disabled={loading}
            sx={{ mt: 2 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Generate Rearrangement Plan'}
          </Button>
        </CardContent>
      </Card>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}
      
      {rearrangementPlan && rearrangementPlan.disorganized_containers && rearrangementPlan.disorganized_containers.length > 0 && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Disorganized Containers
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              The following containers have suboptimal organization. Sorted by inefficiency (most inefficient first).
            </Typography>
            
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Container ID</TableCell>
                    <TableCell>Zone</TableCell>
                    <TableCell>Utilization</TableCell>
                    <TableCell>Efficiency</TableCell>
                    <TableCell>Items</TableCell>
                    <TableCell>Low Priority Items</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rearrangementPlan.disorganized_containers
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((container) => (
                    <TableRow key={container.id}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {container.id}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {container.type}
                        </Typography>
                      </TableCell>
                      <TableCell>{container.zone || '-'}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column', width: '100%' }}>
                          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2">{container.utilization.toFixed(1)}%</Typography>
                            <Chip 
                              size="small" 
                              variant="outlined"
                              icon={
                                container.utilization < 40 ? <WarningIcon fontSize="small" /> : 
                                container.utilization > 85 ? <WarningIcon fontSize="small" /> : 
                                <InfoIcon fontSize="small" />
                              }
                              label={
                                container.utilization < 40 ? "Underutilized" : 
                                container.utilization > 85 ? "Overutilized" : 
                                "Acceptable"
                              }
                              color={getUtilizationSeverity(container.utilization)}
                              sx={{ ml: 1 }}
                            />
                          </Box>
                          <LinearProgress 
                            variant="determinate" 
                            value={container.utilization} 
                            color={getUtilizationSeverity(container.utilization)}
                            sx={{ width: '100%', mt: 1, height: 8, borderRadius: 1 }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color={getEfficiencyColor(container.efficiency_score)}>
                          {container.efficiency_score.toFixed(1)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ({container.inefficiency_score.toFixed(1)} inefficiency)
                        </Typography>
                      </TableCell>
                      <TableCell align="center">{container.total_items}</TableCell>
                      <TableCell align="center">
                        {container.low_priority_items > 0 ? (
                          <Chip 
                            size="small"
                            color="primary"
                            label={container.low_priority_items}
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">0</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={rearrangementPlan.disorganized_containers.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
              />
            </TableContainer>
          </CardContent>
        </Card>
      )}
      
      {rearrangementPlan && (
        <>
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Rearrangement Summary
              </Typography>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                <Paper elevation={1} sx={{ p: 2, flex: '1 1 200px' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Steps
                  </Typography>
                  <Typography variant="h5">
                    {rearrangementPlan.total_steps}
                  </Typography>
                </Paper>
                
                <Paper elevation={1} sx={{ p: 2, flex: '1 1 200px' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Estimated Time
                  </Typography>
                  <Typography variant="h5">
                    {formatTime(rearrangementPlan.total_estimated_time)}
                  </Typography>
                </Paper>
                
                <Paper elevation={1} sx={{ p: 2, flex: '1 1 200px' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Space Optimization
                  </Typography>
                  <Typography variant="h5" color={rearrangementPlan.space_optimization > 0 ? 'success.main' : 'error.main'}>
                    {rearrangementPlan.space_optimization.toFixed(1)}%
                  </Typography>
                </Paper>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="subtitle1" gutterBottom>
                Items to be Moved: {rearrangementPlan.low_priority_items_moved.length}
              </Typography>
              
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {rearrangementPlan.low_priority_items_moved.map((itemId) => (
                  <Chip 
                    key={itemId} 
                    label={itemId} 
                    color="primary" 
                    variant="outlined" 
                    size="small" 
                  />
                ))}
              </Stack>
              
              <Typography variant="subtitle1" gutterBottom>
                High Priority Items (Untouched): {rearrangementPlan.high_priority_items_untouched.length}
              </Typography>
              
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {rearrangementPlan.high_priority_items_untouched.slice(0, 10).map((itemId) => (
                  <Chip 
                    key={itemId} 
                    label={itemId} 
                    color="success" 
                    variant="outlined" 
                    size="small" 
                  />
                ))}
                {rearrangementPlan.high_priority_items_untouched.length > 10 && (
                  <Chip 
                    label={`+${rearrangementPlan.high_priority_items_untouched.length - 10} more`} 
                    variant="outlined" 
                    size="small" 
                  />
                )}
              </Stack>
            </CardContent>
          </Card>
          
          <Typography variant="h6" gutterBottom>
            Step-by-Step Movement Plan
          </Typography>
          
          {rearrangementPlan.movements.length > 0 ? (
            <>
              <TableContainer component={Paper} sx={{ mb: 3 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox"></TableCell>
                      <TableCell>Step</TableCell>
                      <TableCell>Item</TableCell>
                      <TableCell>From → To</TableCell>
                      <TableCell>Priority</TableCell>
                      <TableCell>Est. Time</TableCell>
                      <TableCell>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rearrangementPlan.movements.map((movement) => (
                      <TableRow 
                        key={movement.step}
                        sx={{ 
                          cursor: 'pointer',
                          backgroundColor: selectedMovements.includes(movement.item_id) ? 'rgba(25, 118, 210, 0.08)' : 'inherit'
                        }}
                        onClick={() => toggleMovementSelection(movement.item_id)}
                      >
                        <TableCell padding="checkbox">
                          <CheckCircleIcon 
                            color={selectedMovements.includes(movement.item_id) ? 'primary' : 'disabled'} 
                          />
                        </TableCell>
                        <TableCell>{movement.step}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                            {movement.item_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {movement.item_id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography variant="body2">{movement.from_container_id}</Typography>
                            <ArrowForwardIcon sx={{ mx: 1 }} fontSize="small" />
                            <Typography variant="body2">{movement.to_container_id}</Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            From zone: {movement.from_zone || '-'} → To zone: {movement.to_zone || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            icon={<PriorityHighIcon />}
                            label={movement.priority}
                            size="small"
                            color={
                              movement.priority < 20 ? 'success' :
                              movement.priority < 50 ? 'info' : 'warning'
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            icon={<AccessTimeIcon />}
                            label={formatTime(movement.estimated_time)}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>{movement.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  {selectedMovements.length} of {rearrangementPlan.movements.length} movements selected
                </Typography>
                
                <Button
                  variant="contained"
                  color="success"
                  disabled={applying || selectedMovements.length === 0}
                  onClick={applyRearrangementPlan}
                  startIcon={applying ? <CircularProgress size={20} /> : <CheckCircleIcon />}
                >
                  Apply Selected Movements
                </Button>
              </Box>
            </>
          ) : (
            <Alert severity="info" sx={{ mb: 3 }}>
              No movements needed. The container utilization is already balanced.
            </Alert>
          )}
        </>
      )}
    </Box>
  );
};

export default RearrangementPanel; 